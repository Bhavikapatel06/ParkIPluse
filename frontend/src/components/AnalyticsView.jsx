import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Golden ratio to generate visually distinct colors infinitely
const getDistinctColor = (index) => {
    const hue = (index * 137.508) % 360;
    return `hsl(${hue}, 80%, 55%)`;
};

export default function AnalyticsView({ filters }) {
    const [data, setData] = useState({ byArea: [], byVehicleType: [] });

    useEffect(() => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([k, v]) => {
                if (v) params.append(k, v);
            });
        }
        axios.get(`http://localhost:3000/api/analytics?${params.toString()}`)
            .then(res => setData(res.data))
            .catch(console.error);
    }, [filters]);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-white mb-6">Analytics Dashboard</h1>
            
            <div className="flex flex-col gap-6">
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Violations by Area</h3>
                    <div className="w-full h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.byArea}>
                                <XAxis dataKey="name" stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                                <YAxis stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-panel p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-4">Violations by Vehicle Type</h3>
                    <div className="w-full h-[400px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={data.byVehicleType} 
                                    cx="50%" 
                                    cy="50%" 
                                    innerRadius="40%" 
                                    outerRadius="85%" 
                                    paddingAngle={0} 
                                    dataKey="value"
                                    stroke="#1e293b"
                                    strokeWidth={2}
                                >
                                    {data.byVehicleType.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={getDistinctColor(index)} 
                                            style={{ outline: 'none' }}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: '#334155', color: '#fff', borderRadius: '8px', backdropFilter: 'blur(8px)' }}
                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-3 gap-x-4 mt-8 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {data.byVehicleType.map((entry, idx) => (
                            <div key={idx} className="flex items-center text-sm font-medium text-slate-300 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                                <span className="w-3 h-3 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: getDistinctColor(idx) }}></span>
                                <span className="truncate flex-1">{entry.name}</span>
                                <span className="ml-2 text-white font-bold bg-slate-900/50 px-2 py-0.5 rounded text-xs">
                                    {((entry.value / Math.max(1, data.byVehicleType.reduce((a, b) => a + (b.value || 0), 0))) * 100).toFixed(1)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
