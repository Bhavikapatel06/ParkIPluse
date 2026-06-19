const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const axios = require('axios');
const Violation = require('./models/Violation');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/parkpulse')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Connection Error: ', err));

// Routes
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
            // Mapping CSV to schema
            if(data.latitude && data.longitude) {
                let v_status = data.validation_status ? data.validation_status.trim() : 'Pending';
                if (v_status.toLowerCase() === 'null' || v_status === '') {
                    v_status = 'Pending';
                }
                v_status = v_status.charAt(0).toUpperCase() + v_status.slice(1).toLowerCase();

                let v_type = data.violation_type || 'Unknown';
                if (v_type.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(v_type);
                        v_type = parsed[0] || 'Unknown';
                    } catch(e) {}
                }

                results.push({
                    latitude: parseFloat(data.latitude),
                    longitude: parseFloat(data.longitude),
                    vehicle_type: data.vehicle_type || 'Unknown',
                    violation_type: v_type,
                    created_datetime: data.created_datetime ? new Date(data.created_datetime) : new Date(),
                    police_station: data.police_station || 'Unknown',
                    junction_name: data.junction_name || 'Unknown',
                    validation_status: v_status
                });
            }
        })
        .on('end', async () => {
            try {
                if (results.length > 0) {
                    await Violation.insertMany(results);
                }
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path); // remove temp file
                }
                res.status(200).json({ message: 'Upload successful', count: results.length });
            } catch (err) {
                console.error("CSV Upload Error: ", err);
                res.status(500).json({ error: err.message });
            }
        });
});

app.get('/api/dashboard', async (req, res) => {
    try {
        const total = await Violation.countDocuments();
        const approved = await Violation.countDocuments({ validation_status: 'Approved' });
        const rejected = await Violation.countDocuments({ validation_status: 'Rejected' });
        
        const topAreaAgg = await Violation.aggregate([
            { $group: { _id: "$police_station", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);
        const highestRiskArea = topAreaAgg.length > 0 && topAreaAgg[0]._id ? topAreaAgg[0]._id : "Unknown";
        
        // Estimate active hotspots based on total density for MVP
        const activeHotspots = Math.max(5, Math.floor(total / 5000)); 
        
        res.json({
            totalViolations: total,
            approvedViolations: approved,
            rejectedViolations: rejected,
            activeHotspots,
            highestRiskArea
        });
    } catch(err) {
        res.status(500).json({error: err.message});
    }
});

app.get('/api/heatmap', async (req, res) => {
    try {
        const violations = await Violation.find({}, 'latitude longitude validation_status').lean();
        res.json(violations);
    } catch(err) {
        res.status(500).json({error: err.message});
    }
});

app.get('/api/hotspots', async (req, res) => {
    try {
        // Limit to 5000 records. We removed the sort() because sorting 300,000 records without an index crashes MongoDB memory limits!
        const violations = await Violation.find({}, 'latitude longitude police_station')
            .limit(5000)
            .lean();
            
        const locations = violations.map(v => ({ 
            lat: v.latitude, 
            lng: v.longitude,
            area: v.police_station || 'Unknown'
        }));
        
        // Call Python AI service
        try {
            const aiResponse = await axios.post('http://localhost:5000/api/hotspots', { locations });
            res.json(aiResponse.data);
        } catch(aiErr) {
            console.error("AI Service Error", aiErr.message);
            res.status(500).json({ error: "Could not fetch hotspots from AI service." });
        }
    } catch(err) {
        res.status(500).json({error: err.message});
    }
});

app.get('/api/recommendations', async (req, res) => {
    try {
        const topAreas = await Violation.aggregate([
            { $group: { _id: "$police_station", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 6 }
        ]);
        
        const total = await Violation.countDocuments();
        
        const recommendations = topAreas.map((area, index) => {
            const location = area._id || 'Unknown Region';
            // Calculate a real risk score from 0-100 based on how many violations this area has compared to total
            // We scale it so the highest areas are naturally in the 80-95+ range
            const risk = Math.min(100, Math.max(30, Math.floor((area.count / (total || 1)) * 500) + 60));
            
            let recText;
            if (risk > 90) {
                recText = `Critical density: ${area.count} violations detected! Deploy 3-4 traffic marshals immediately and consider automated enforcement cameras.`;
            } else if (risk > 75) {
                recText = `High violation rate (${area.count} total). Increase patrol frequency during known peak hours to deter illegal parking.`;
            } else {
                recText = `Moderate risk with ${area.count} total violations. Review current parking signage visibility and consider setting up temporary barricades.`;
            }
            return { location, risk, recommendation: recText };
        });
        
        res.json(recommendations);
    } catch(err) {
        res.status(500).json({error: err.message});
    }
});

app.get('/api/analytics', async (req, res) => {
    try {
        // Simple aggregation for charts
        const byVehicleType = await Violation.aggregate([
            { $group: { _id: "$vehicle_type", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        const byArea = await Violation.aggregate([
            { $group: { _id: "$police_station", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        res.json({
            byVehicleType: byVehicleType.map(x => ({ name: x._id, value: x.count })),
            byArea: byArea.map(x => ({ name: x._id, value: x.count }))
        });
    } catch(err) {
        res.status(500).json({error: err.message});
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
