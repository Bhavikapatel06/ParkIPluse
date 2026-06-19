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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
