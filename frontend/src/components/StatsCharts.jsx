import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';

const WASTE_COLORS = {
  Plastic: '#2563eb',
  Paper: '#f59e0b',
  Metal: '#8b5cf6',
  Glass: '#06b6d4',
  Organic: '#10b981',
  Other: '#f43f5e',
};

function StatsCharts({ bins }) {
  if (!bins || bins.length === 0) {
    return (
      <div className="modern-empty-state">
        <p>No telemetry records available for distribution charts</p>
      </div>
    );
  }

  // Waste type distribution
  const typeCounts = {};
  bins.forEach(b => {
    const wt = b.waste_type || 'Other';
    typeCounts[wt] = (typeCounts[wt] || 0) + 1;
  });

  const typeData = Object.entries(typeCounts).map(([name, count]) => ({
    name,
    count,
    fill: WASTE_COLORS[name] || '#64748b',
  }));

  // Fill level distribution
  const fillBuckets = [
    { name: '0-25%', count: 0, fill: '#10b981' },
    { name: '26-50%', count: 0, fill: '#06b6d4' },
    { name: '51-75%', count: 0, fill: '#f59e0b' },
    { name: '76-100%', count: 0, fill: '#f43f5e' },
  ];

  bins.forEach(b => {
    const f = b.current_fill_percent;
    if (f <= 25) fillBuckets[0].count++;
    else if (f <= 50) fillBuckets[1].count++;
    else if (f <= 75) fillBuckets[2].count++;
    else fillBuckets[3].count++;
  });

  return (
    <div className="stats-charts-wrapper">
      <div className="chart-sub-section">
        <div className="chart-mini-header">
          <span className="chart-mini-label">Categorical Stream Allocation</span>
        </div>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={72}
                paddingAngle={3}
                dataKey="count"
              >
                {typeData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  borderRadius: 10,
                  boxShadow: '0 8px 20px -4px rgba(0,0,0,0.1)',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#64748b' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-sub-section mt-4">
        <div className="chart-mini-header">
          <span className="chart-mini-label">Fill Bracket Dispersion</span>
        </div>
        <div style={{ width: '100%', height: 160 }}>
          <ResponsiveContainer>
            <BarChart data={fillBuckets} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15, 23, 42, 0.06)" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
                axisLine={{ stroke: 'rgba(15, 23, 42, 0.08)' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 11 }} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  borderRadius: 10,
                  boxShadow: '0 8px 20px -4px rgba(0,0,0,0.1)',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
              <Bar dataKey="count" name="Bins" radius={[5, 5, 0, 0]}>
                {fillBuckets.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default StatsCharts;
