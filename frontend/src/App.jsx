import { useState, useEffect, useRef } from 'react';

const MAX_VOTES = 3;

function App() {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [teamInput, setTeamInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [stage, setStage] = useState('setup');
  const [facilitator, setFacilitator] = useState(null);
  const [votesUsed, setVotesUsed] = useState(0);
  const [myVotes, setMyVotes] = useState({});

  const [columns, setColumns] = useState([
    { id: 'start', title: 'Start', items: [] },
    { id: 'stop', title: 'Stop', items: [] },
    { id: 'continue', title: 'Continue', items: [] }
  ]);

  const [newItemText, setNewItemText] = useState({ start: '', stop: '', continue: '' });
  const socketRef = useRef(null);

  useEffect(() => {
    if (!teamId) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const encodedUser = encodeURIComponent(user || 'Anonymous');
    const wsUrl = `${wsProtocol}//127.0.0.1:8000/ws/retro/${teamId}/?username=${encodedUser}`;

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
      } else if (data.type === 'presence_update') {
        setConnectedUsers(data.users || []);
      } else if (data.type === 'stage_updated') {
        setStage(data.stage);
      } else if (data.type === 'vote_updated') {
        setColumns((prevCols) =>
          prevCols.map((col) => ({
            ...col,
            items: col.items.map((item) =>
              item.id === data.item_id ? { ...item, vote_count: data.vote_count } : item
            )
          }))
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
      setStage(data.stage || 'setup');
      setFacilitator(data.facilitator || null);
      setVotesUsed(data.used_votes || 0);
      setMyVotes(data.my_votes || {});
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
    if (stage !== 'entry') return;
    const text = newItemText[columnId];
    if (!text || !text.trim()) return;

    const payload = {
      type: 'create_item',
      column: columnId,
      text: text.trim(),
      author: user,
    };

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

  const handleStageChange = (newStage) => {
    setStage(newStage);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'change_stage',
        stage: newStage
      }));
    }
  };

  const handleAddVote = (itemId) => {
    if (votesUsed >= MAX_VOTES) return;
    setVotesUsed((v) => v + 1);
    setMyVotes((mv) => ({ ...mv, [itemId]: (mv[itemId] || 0) + 1 }));
    setColumns((prevCols) =>
      prevCols.map((col) => ({
        ...col,
        items: col.items.map((item) =>
          item.id === itemId ? { ...item, vote_count: (item.vote_count || 0) + 1 } : item
        )
      }))
    );
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'add_vote', item_id: itemId }));
    }
  };

  const handleRemoveVote = (itemId) => {
    if (!myVotes[itemId]) return;
    setVotesUsed((v) => v - 1);
    setMyVotes((mv) => ({ ...mv, [itemId]: mv[itemId] - 1 }));
    setColumns((prevCols) =>
      prevCols.map((col) => ({
        ...col,
        items: col.items.map((item) =>
          item.id === itemId ? { ...item, vote_count: Math.max(0, (item.vote_count || 0) - 1) } : item
        )
      }))
    );
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'remove_vote', item_id: itemId }));
    }
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2 mr-1">
              {connectedUsers.map((u, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-indigo-500 border-2 border-slate-900 flex items-center justify-center text-xs font-bold ring-1 ring-indigo-500/30 shadow-sm" title={u}>
                  {u.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            {connectedUsers.length > 0 && (
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">{connectedUsers.length} online</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full text-slate-300">
              Stage: <span className="font-semibold text-white uppercase">{stage}</span>
            </div>
            {stage === 'voting' && (
              <div className="text-xs bg-amber-900/50 border border-amber-500/50 px-3 py-1.5 rounded-full text-amber-200">
                Votes: <span className="font-semibold">{MAX_VOTES - votesUsed}</span>/{MAX_VOTES} remaining
              </div>
            )}
            {user === facilitator && (
              <select
                value={stage}
                onChange={(e) => handleStageChange(e.target.value)}
                className="bg-slate-800 text-xs border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
              >
                <option value="setup">Setup</option>
                <option value="entry">Entry</option>
                <option value="grouping">Grouping</option>
                <option value="voting">Voting</option>
                <option value="discuss">Discuss</option>
                <option value="closed">Closed</option>
              </select>
            )}
            <div className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full text-slate-300">
              Facilitator: <span className="font-semibold text-indigo-400">{facilitator || 'None'}</span>
            </div>
            <div className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full text-slate-300">
              <span className="font-semibold text-white">{user}</span> from Team <span className="font-semibold text-white">{team}</span>
            </div>
          </div>
        </div>
      </header>
      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((col) => (
          <div key={col.id} className="bg-slate-800 rounded-xl p-4 flex flex-col shadow-lg border border-slate-700">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4 text-indigo-400 border-b border-slate-700 pb-2">{col.title}</h2>
            <div className="flex-1 space-y-3 mb-4">
              {col.items.map((item, index) => (
                <div key={index} className="bg-slate-700 p-3 rounded-lg text-sm shadow border border-slate-600 flex flex-col gap-2">
                  <span>{typeof item === 'string' ? item : item.text}</span>
                  <div className="flex items-center justify-between mt-1">
                    {item.author && <span className="text-[10px] text-slate-400">@{item.author}</span>}
                    {stage === 'voting' && item.id && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => handleRemoveVote(item.id)}
                          disabled={!myVotes[item.id]}
                          className="w-6 h-6 rounded bg-slate-600 hover:bg-slate-500 text-slate-200 flex items-center justify-center text-xs disabled:opacity-30"
                        >−</button>
                        <span className="text-xs font-semibold text-white min-w-[24px] text-center">
                          {item.vote_count || 0}
                          {myVotes[item.id] ? <span className="text-amber-400 ml-0.5">({myVotes[item.id]})</span> : null}
                        </span>
                        <button
                          onClick={() => handleAddVote(item.id)}
                          disabled={votesUsed >= MAX_VOTES}
                          className="w-6 h-6 rounded bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-xs disabled:opacity-30"
                        >+</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {col.items.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4 italic">No items yet.</p>
              )}
            </div>
            {stage === 'entry' && (
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
            )}
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
