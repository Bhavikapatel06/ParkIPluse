import os
# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.cluster import DBSCAN
# pyrefly: ignore [missing-import]
import numpy as np

app = Flask(__name__)
CORS(app)

@app.route('/api/hotspots', methods=['POST'])
def detect_hotspots():
    data = request.json
    if not data or 'locations' not in data:
        return jsonify({'error': 'No locations provided'}), 400
    
    locations = data['locations'] # list of dicts: {'lat': float, 'lng': float}
    if not locations:
        return jsonify({'hotspots': []})
        
    df = pd.DataFrame(locations)
    
    # DBSCAN clustering
    # Adjusted for Hackathon MVP: Make parameters more lenient so large, visible clusters always appear
    eps = 0.005 # ~500 meters
    min_samples = 3
    
    # Convert lat/lng to radians for haversine metric if needed, 
    # but for simple approx in city we can use euclidean on lat/lng or just adjust eps.
    coords = df[['lat', 'lng']].values
    
    db = DBSCAN(eps=eps, min_samples=min_samples, metric='euclidean').fit(coords)
    
    df['cluster'] = db.labels_
    
    # -1 means noise (not a hotspot)
    hotspots_df = df[df['cluster'] != -1]
    
    hotspots = []
    
    for cluster_id, group in hotspots_df.groupby('cluster'):
        center_lat = group['lat'].mean()
        center_lng = group['lng'].mean()
        count = len(group)
        
        # Get the most common area name in this cluster
        top_area = group['area'].mode()[0] if 'area' in group else 'Unknown'
        
        # Determine risk level based on count
        if count < 10:
            risk_level = "Low"
            risk_score = count * 2
        elif count < 30:
            risk_level = "Moderate"
            risk_score = count * 2 + 20
        elif count < 60:
            risk_level = "High"
            risk_score = count * 1.5 + 40
        else:
            risk_level = "Critical"
            risk_score = min(100, count * 1.2 + 50)
            
        hotspots.append({
            'id': int(cluster_id),
            'lat': float(center_lat),
            'lng': float(center_lng),
            'count': int(count),
            'area': str(top_area),
            'risk_level': risk_level,
            'risk_score': min(100, int(risk_score))
        })
        
    # Sort by risk score
    hotspots.sort(key=lambda x: x['risk_score'], reverse=True)
        
    return jsonify({'hotspots': hotspots})

@app.route('/api/predict', methods=['POST'])
def predict_congestion():
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.preprocessing import LabelEncoder
    
    data = request.json
    if not data or 'history' not in data or 'target' not in data:
        return jsonify({'error': 'History and target are required'}), 400
        
    history = data['history']  # List of: {'location': str, 'vehicle_type': str, 'hour': int, 'day_of_week': int, 'count': int}
    target = data['target']    # Dict of: {'location': str, 'vehicle_type': str, 'hour': int, 'day_of_week': int}
    
    if not history:
        return jsonify({'tomorrow_risk': 20, 'next_week_risk': 25})
        
    df = pd.DataFrame(history)
    
    try:
        # Preprocessing label encoders
        le_loc = LabelEncoder()
        le_veh = LabelEncoder()
        
        all_locations = list(df['location'].unique())
        if target['location'] not in all_locations:
            all_locations.append(target['location'])
        le_loc.fit(all_locations)
        
        all_vehicles = list(df['vehicle_type'].unique())
        if target['vehicle_type'] not in all_vehicles:
            all_vehicles.append(target['vehicle_type'])
        le_veh.fit(all_vehicles)
        
        df['location_enc'] = le_loc.transform(df['location'])
        df['vehicle_enc'] = le_veh.transform(df['vehicle_type'])
        
        X = df[['location_enc', 'vehicle_enc', 'hour', 'day_of_week']].values
        y = df['count'].values
        
        # Train Random Forest Regressor
        rf = RandomForestRegressor(n_estimators=30, random_state=42)
        rf.fit(X, y)
        
        max_count = float(df['count'].max()) if len(df) > 0 else 1.0
        if max_count == 0:
            max_count = 1.0
            
        target_loc_enc = le_loc.transform([target['location']])[0]
        target_veh_enc = le_veh.transform([target['vehicle_type']])[0]
        target_hour = int(target['hour'])
        
        # Predict Tomorrow
        tomorrow_day = (int(target['day_of_week']) + 1) % 7
        tomorrow_features = np.array([[target_loc_enc, target_veh_enc, target_hour, tomorrow_day]])
        tomorrow_pred = rf.predict(tomorrow_features)[0]
        tomorrow_risk = min(100, max(0, int((tomorrow_pred / max_count) * 100)))
        
        # Predict Next Week
        next_week_day = int(target['day_of_week'])
        next_week_features = np.array([[target_loc_enc, target_veh_enc, target_hour, next_week_day]])
        next_week_pred = rf.predict(next_week_features)[0]
        next_week_risk = min(100, max(0, int((next_week_pred / max_count) * 100)))
        
        # 24-Hour Forecast (for target day)
        hourly_forecast = []
        for h in range(24):
            feat = np.array([[target_loc_enc, target_veh_enc, h, int(target['day_of_week'])]])
            pred = rf.predict(feat)[0]
            risk = min(100, max(0, int((pred / max_count) * 100)))
            hourly_forecast.append({'hour': f"{h:02d}:00", 'risk': risk})
            
        # 7-Day Risk Trend (for target hour)
        days_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        weekly_trend = []
        for d in range(7):
            feat = np.array([[target_loc_enc, target_veh_enc, target_hour, d]])
            pred = rf.predict(feat)[0]
            risk = min(100, max(0, int((pred / max_count) * 100)))
            weekly_trend.append({'day': days_names[d], 'risk': risk})
            
        # Future Hotspots (for target vehicle/hour/day)
        future_hotspots = []
        for loc in all_locations:
            loc_enc = le_loc.transform([loc])[0]
            feat = np.array([[loc_enc, target_veh_enc, target_hour, int(target['day_of_week'])]])
            pred = rf.predict(feat)[0]
            risk = min(100, max(0, int((pred / max_count) * 100)))
            future_hotspots.append({'area': loc, 'risk': risk})
            
        future_hotspots.sort(key=lambda x: x['risk'], reverse=True)
        top_future_hotspots = future_hotspots[:5]
        
        return jsonify({
            'tomorrow_risk': tomorrow_risk,
            'next_week_risk': next_week_risk,
            'hourly_forecast': hourly_forecast,
            'weekly_trend': weekly_trend,
            'future_hotspots': top_future_hotspots
        })
    except Exception as e:
        print("Prediction Error: ", str(e))
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
