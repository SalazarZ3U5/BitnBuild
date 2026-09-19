import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';

const WASTE_COLORS = {
  Plastic: '#3b82f6',
  Paper: '#f59e0b',
  Metal: '#8b5cf6',
  Glass: '#06b6d4',
  Organic: '#10b981',
  Other: '#ef4444',
};

function StatsCharts({ bins }) {
  if (!bins || bins.length === 0) {
    return (
      <div className="empty-state">
        <p>No bin data available for charts</p>
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
    { name: '76-100%', count: 0, fill: '#ef4444' },
  ];

  bins.forEach(b => {
    const f = b.current_fill_percent;
    if (f <= 25) fillBuckets[0].count++;
    else if (f <= 50) fillBuckets[1].count++;
    else if (f <= 75) fillBuckets[2].count++;
    else fillBuckets[3].count++;
  });

  return (
    <div>
      <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Bins by Waste Type
      </h4>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={typeData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={3}
              dataKey="count"
            >
              {typeData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#1a1f35',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: 8,
                color: '#f1f5f9',
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', marginTop: '1rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Fill Level Distribution
      </h4>
      <div style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer>
          <BarChart data={fillBuckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: '#1a1f35',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: 8,
                color: '#f1f5f9',
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" name="Bins" radius={[4, 4, 0, 0]}>
              {fillBuckets.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default StatsCharts;
