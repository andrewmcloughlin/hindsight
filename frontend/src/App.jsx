import { useState, useEffect, useRef } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [teamInput, setTeamInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [columns, setColumns] = useState([
    { id: 'start', title: 'Start', items: [] },
    { id: 'stop', title: 'Stop', items: [] },
    { id: 'continue', title: 'Continue', items: [] }
  ]);
  
  const [newItemText, setNewItemText] = useState({ start: '', stop: '', continue: '' });
  const socketRef = useRef(null);

  // Establish WebSocket connection once user and team are established
  useEffect(() => {
    if (!teamId) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//127.0.0.1:8000/ws/retro/${teamId}/`;
    
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log('Real-time connection established.');
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'retro_item_created') {
        setColumns((prevCols) =>
          prevCols.map((col) => {
            if (col.id !== data.column) return col;
            const alreadyExists = col.items.some((i) => i.id && i.id === data.item.id);
            if (alreadyExists) return col;
            return { ...col, items: [...col.items, data.item] };
          })
        );
      }
    };

    socketRef.current.onclose = () => {
      console.log('Real-time connection closed.');
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [teamId]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!nameInput.trim() || !teamInput.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/teams/join/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: nameInput.trim(),
          team_name: teamInput.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to join retrospective session.');
      }

      const data = await response.json();
      setUser(data.username);
      setTeam(data.team_name);
      setTeamId(data.team_id || data.team_name.toLowerCase().replace(/\s+/g, '-'));
    } catch (err) {
      console.warn('API connection failed, falling back to local mock session:', err);
      setUser(nameInput.trim());
      setTeam(teamInput.trim());
      setTeamId('mock-team-id');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (columnId) => {
    const text = newItemText[columnId];
    if (!text || !text.trim()) return;

    const payload = {
      type: 'create_item',
      column: columnId,
      text: text.trim(),
      author: user,
    };

    // Optimistic update so the sender sees the item immediately
    const optimisticItem = { text: text.trim(), author: user };
    setColumns((prevCols) =>
      prevCols.map((col) =>
        col.id === columnId ? { ...col, items: [...col.items, optimisticItem] } : col
      )
    );

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }

    setNewItemText({ ...newItemText, [columnId]: '' });
  };

  if (!user || !team) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-center">Hindsight</h1>
          <p className="text-slate-400 text-sm text-center mb-6">Enter your details to join the retrospective</p>
          {error && <div className="mb-4 bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg text-xs">{error}</div>}
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Your Name</label>
              <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="e.g. Sir Lancelot" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 text-sm" required />
            </div>
            <div>
              <label className="label text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Team Name</label>
              <input type="text" value={teamInput} onChange={(e) => setTeamInput(e.target.value)} placeholder="e.g. Knights of the Round Table" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 text-sm" required />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors text-sm shadow disabled:opacity-50">
              {loading ? 'Joining...' : 'Join Retrospective'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <header className="mb-8 flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Hindsight</h1>
        </div>
        <div className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full text-slate-300">
          <span className="font-semibold text-white">{user}</span> from Team <span className="font-semibold text-white">{team}</span>
        </div>
      </header>
      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((col) => (
          <div key={col.id} className="bg-slate-800 rounded-xl p-4 flex flex-col shadow-lg border border-slate-700">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4 text-indigo-400 border-b border-slate-700 pb-2">{col.title}</h2>
            <div className="flex-1 space-y-3 mb-4">
              {col.items.map((item, index) => (
                <div key={index} className="bg-slate-700 p-3 rounded-lg text-sm shadow border border-slate-600 flex flex-col">
                  <span>{typeof item === 'string' ? item : item.text}</span>
                  {item.author && <span className="text-[10px] text-slate-400 mt-1 self-end">@{item.author}</span>}
                </div>
              ))}
              {col.items.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4 italic">No items yet.</p>
              )}
            </div>
            <div className="space-y-2 mt-auto">
              <input
                type="text"
                placeholder="Type a thought..."
                value={newItemText[col.id]}
                onChange={(e) => setNewItemText({ ...newItemText, [col.id]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem(col.id)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleAddItem(col.id)}
                className="w-full bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 font-medium py-1.5 px-3 rounded-lg transition-colors text-xs"
              >
                + Add item
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
