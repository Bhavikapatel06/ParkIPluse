import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Sparkles, AlertTriangle, Users, Gauge, Info } from 'lucide-react';

const EVENTS = [
  { id: 'festival', name: 'Festival Celebration', pressure: 55, congestion: 45, officers: 10 },
  { id: 'concert', name: 'Major Music Concert', pressure: 45, congestion: 35, officers: 8 },
  { id: 'sale', name: 'Big Shopping Sale', pressure: 35, congestion: 25, officers: 6 },
  { id: 'metro', name: 'Metro Line Launch / Event', pressure: 25, congestion: 15, officers: 4 }
];

export default function SimulationView({ metadata }) {
  const policeStations = metadata?.policeStations || [];
  const [selectedEvent, setSelectedEvent] = useState('festival');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [results, setResults] = useState(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (policeStations.length > 0 && (!selectedLocation || !policeStations.includes(selectedLocation))) {
      setSelectedLocation(policeStations[0]);
    }
  }, [policeStations]);

  useEffect(() => {
    // Fetch analytics to scale officer counts relative to baseline location traffic
    axios.get('http://localhost:3000/api/analytics')
      .then(res => setAnalytics(res.data))
      .catch(console.error);
  }, []);

  const handleSimulate = () => {
    setSimulating(true);
    setResults(null);

    setTimeout(() => {
      const eventData = EVENTS.find(e => e.id === selectedEvent);
      
      // Calculate multiplier based on baseline location density
      let baselineScale = 1.0;
      if (analytics && analytics.byArea) {
        const areaData = analytics.byArea.find(a => a.name === selectedLocation);
        const totalAreaCount = analytics.byArea.reduce((sum, item) => sum + item.value, 0);
        const avgAreaCount = totalAreaCount / POLICE_STATIONS.length;
        
        if (areaData) {
          baselineScale = areaData.value / Math.max(1, avgAreaCount);
        }
      }

      // Cap scaling to keep results realistic
      const scaledScale = Math.min(1.8, Math.max(0.5, baselineScale));
      
      const parkingPressure = Math.min(100, Math.floor(eventData.pressure * scaledScale));
      const congestionIncrease = Math.min(100, Math.floor(eventData.congestion * scaledScale));
      const recommendedOfficers = Math.max(2, Math.floor(eventData.officers * scaledScale));

      setResults({
        parkingPressure,
        congestionIncrease,
        recommendedOfficers
      });
      setSimulating(false);
    }, 1200); // Simulated delay for premium UX
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-8 h-8 text-amber-500" />
        <h1 className="text-2xl font-bold text-white">Event Impact Simulator</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Selection */}
        <div className="glass-panel p-6 lg:col-span-1 h-fit">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Simulation Scenario</h3>
          
          <div className="flex flex-col gap-5">
            {/* Event Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                Event Type
              </label>
              <div className="flex flex-col gap-2">
                {EVENTS.map(event => (
                  <label 
                    key={event.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedEvent === event.id 
                        ? 'bg-amber-500/10 border-amber-500 text-white' 
                        : 'bg-slate-800/30 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="eventType" 
                        value={event.id}
                        checked={selectedEvent === event.id}
                        onChange={() => setSelectedEvent(event.id)}
                        className="accent-amber-500"
                      />
                      <span className="text-sm font-semibold">{event.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Location Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Target Location / Area
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="bg-surface text-sm text-white p-2.5 rounded-lg border border-slate-700 focus:border-amber-500 focus:outline-none"
              >
                {policeStations.map(station => (
                  <option key={station} value={station} className="bg-slate-900 text-white">{station}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSimulate}
              disabled={simulating}
              className="mt-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              {simulating ? 'Simulating Impacts...' : 'Run Simulation'}
            </button>
          </div>
        </div>

        {/* Right: Outcomes Display */}
        <div className="glass-panel p-6 lg:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Impact Projections</h3>

            {!results && !simulating && (
              <div className="h-[300px] flex flex-col items-center justify-center text-slate-400">
                <Gauge className="w-12 h-12 mb-3 text-slate-600 animate-pulse" />
                <p className="text-sm">Configure event parameters and run the simulation.</p>
              </div>
            )}

            {simulating && (
              <div className="h-[300px] flex flex-col items-center justify-center text-slate-400">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-medium">Crunching spatial historical data multipliers...</p>
                <p className="text-xs text-slate-500 mt-1">Modeling traffic density & congestion coefficients.</p>
              </div>
            )}

            {results && !simulating && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
                {/* Parking Pressure */}
                <div className="flex flex-col items-center p-6 bg-slate-800/40 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 text-sm font-semibold mb-4 text-center">Parking Pressure Increase</span>
                  <div className="relative flex items-center justify-center w-28 h-28 rounded-full border-4 border-red-500/20 text-red-500">
                    <span className="text-2xl font-black">+{results.parkingPressure}%</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-4 text-center">
                    Increased demand on public/street parking compared to baseline.
                  </span>
                </div>

                {/* Congestion Increase */}
                <div className="flex flex-col items-center p-6 bg-slate-800/40 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 text-sm font-semibold mb-4 text-center">Congestion Increase</span>
                  <div className="relative flex items-center justify-center w-28 h-28 rounded-full border-4 border-orange-500/20 text-orange-500">
                    <span className="text-2xl font-black">+{results.congestionIncrease}%</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-4 text-center">
                    Projected slowdown in local average vehicle speeds.
                  </span>
                </div>

                {/* Recommended Officers */}
                <div className="flex flex-col items-center p-6 bg-slate-800/40 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 text-sm font-semibold mb-4 text-center">Recommended Officers</span>
                  <div className="relative flex items-center justify-center w-28 h-28 rounded-full border-4 border-blue-500/20 text-blue-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-5 h-5 text-blue-500" />
                      <span className="text-2xl font-black">{results.recommendedOfficers}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-4 text-center">
                    Traffic marshals recommended to handle parking overflows.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/20 p-4 rounded-lg border border-slate-700/30 text-xs text-slate-400 leading-relaxed mt-4 flex gap-2">
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Simulation Mechanics:</strong> Projections scale dynamically based on the selected event's multiplier and the historical congestion density of the chosen target area. Major areas like <em>Madiwala</em> or <em>HSR Layout</em> automatically trigger higher officer requirements.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
