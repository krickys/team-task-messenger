import { useEffect, useState } from 'react';

// Mock Firebase functions for demonstration
const mockDb = {
  users: {},
  groups: {},
  chats: { private: {}, group: {} },
  tasks: {}
};

const mockAuth = {
  currentUser: null,
  onAuthStateChanged: (callback) => {
    // Mock auth state change
    return () => {};
  }
};

// Mock Firebase functions
const ref = (db, path) => ({ path });
const set = (ref, data) => {
  const pathParts = ref.path.split('/');
  let current = mockDb;
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (!current[pathParts[i]]) current[pathParts[i]] = {};
    current = current[pathParts[i]];
  }
  current[pathParts[pathParts.length - 1]] = data;
  console.log('Set:', ref.path, data);
};

const update = (ref, data) => {
  const pathParts = ref.path.split('/');
  let current = mockDb;
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (!current[pathParts[i]]) current[pathParts[i]] = {};
    current = current[pathParts[i]];
  }
  Object.assign(current[pathParts[pathParts.length - 1]] || {}, data);
  console.log('Update:', ref.path, data);
};

const onValue = (ref, callback) => {
  // Mock real-time listener
  const pathParts = ref.path.split('/');
  let current = mockDb;
  for (const part of pathParts) {
    current = current[part];
    if (!current) break;
  }
  
  callback({ val: () => current });
  return () => {};
};

const signInWithEmailAndPassword = (auth, email, password) => {
  return Promise.resolve({ user: { email } });
};

const createUserWithEmailAndPassword = (auth, email, password) => {
  return Promise.resolve({ user: { email } });
};

const signOut = (auth) => {
  return Promise.resolve();
};

// FIXED utility functions - RESOLVES FIREBASE PATH ERROR!
const encodeEmail = (email) => {
  if (!email) return '';
  // Replace Firebase invalid characters with safe alternatives
  return email
    .replace(/\./g, '_dot_')      // Replace . with _dot_
    .replace(/@/g, '_at_')        // Replace @ with _at_  
    .replace(/#/g, '_hash_')      // Replace # with _hash_
    .replace(/\$/g, '_dollar_')   // Replace $ with _dollar_
    .replace(/\[/g, '_lbracket_') // Replace [ with _lbracket_
    .replace(/\]/g, '_rbracket_'); // Replace ] with _rbracket_
};

const createChatId = (email1, email2) => {
  const encoded1 = encodeEmail(email1);
  const encoded2 = encodeEmail(email2);
  return [encoded1, encoded2].sort().join('_');
};

// Auth Component
const AuthForm = ({ 
  isRegistering, 
  setIsRegistering, 
  handleAuth, 
  email, 
  setEmail, 
  password, 
  setPassword 
}) => (
  <div style={{ padding: 50, maxWidth: 400, margin: 'auto' }}>
    <h2>{isRegistering ? "Register" : "Login"}</h2>
    <input 
      value={email} 
      onChange={e => setEmail(e.target.value)} 
      placeholder="Email" 
      style={{ display: 'block', marginBottom: 10, padding: 8, width: '100%' }} 
    />
    <input 
      value={password} 
      onChange={e => setPassword(e.target.value)} 
      type="password" 
      placeholder="Password" 
      style={{ display: 'block', marginBottom: 10, padding: 8, width: '100%' }} 
    />
    <button 
      onClick={handleAuth} 
      style={{ padding: 10, width: '100%', marginBottom: 10 }}
    >
      {isRegistering ? "Register" : "Login"}
    </button>
    <div style={{ fontSize: '0.9rem', color: '#555', textAlign: 'center' }}>
      {isRegistering ? "Already have an account?" : "New user?"} 
      <span 
        onClick={() => setIsRegistering(!isRegistering)} 
        style={{ color: 'blue', cursor: 'pointer' }}
      >
        {isRegistering ? " Login" : " Register"}
      </span>
    </div>
  </div>
);

// Group Admin Controls Component
const GroupAdminControls = ({ 
  groupId, 
  group, 
  currentUser, 
  onPromote, 
  onRemove 
}) => (
  group.admin === currentUser && (
    <div style={{ fontSize: '0.75rem', marginBottom: 4 }}>
      <strong>Admin Controls:</strong>
      {group.members?.map(member => (
        member !== currentUser && (
          <div key={member} style={{ marginBottom: 4 }}>
            <span style={{ marginRight: 8 }}>{member}</span>
            <button 
              onClick={() => onPromote(groupId, member)}
              style={{ fontSize: '0.7rem', marginRight: 4 }}
            >
              Make Admin
            </button>
            <button 
              onClick={() => onRemove(groupId, member)}
              style={{ fontSize: '0.7rem' }}
            >
              Remove
            </button>
          </div>
        )
      ))}
    </div>
  )
);

// Main Component
export default function InternalMessagingApp() {
  const [user, setUser] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [groups, setGroups] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [chatType, setChatType] = useState("private");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState("chat"); // "chat" or "tasks"
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);

  const currentUser = user?.email;

  // Authentication state listener
  useEffect(() => {
    const unsubscribe = mockAuth.onAuthStateChanged(u => setUser(u));
    return () => unsubscribe();
  }, []);

  // Users listener
  useEffect(() => {
    if (!currentUser) return;
    const usersRef = ref(mockDb, "users");
    return onValue(usersRef, snapshot => {
      const data = snapshot.val();
      if (data) {
        const users = Object.values(data)
          .map(u => u.email)
          .filter(e => e !== currentUser);
        setAllUsers(users);
      }
    });
  }, [currentUser]);

  // Groups listener
  useEffect(() => {
    if (!currentUser) return;
    const groupsRef = ref(mockDb, "groups");
    return onValue(groupsRef, snapshot => {
      const data = snapshot.val();
      if (data) setGroups(data);
    });
  }, [currentUser]);

  // Tasks listener
  useEffect(() => {
    if (!currentUser || !selectedChat || chatType !== "private") {
      setTasks([]);
      return;
    }
    
    const encodedSelectedChat = encodeEmail(selectedChat);
    console.log('Tasks listener - encoded chat:', encodedSelectedChat);
    
    const tasksRef = ref(mockDb, `tasks/${encodedSelectedChat}`);
    return onValue(tasksRef, snapshot => {
      const data = snapshot.val();
      if (data) {
        const taskArray = Object.entries(data)
          .map(([id, task]) => ({ id, ...task }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTasks(taskArray);
      } else {
        setTasks([]);
      }
    });
  }, [currentUser, selectedChat, chatType]);

  // Fixed Messages listener with proper read receipts
  useEffect(() => {
    if (!currentUser || !selectedChat) {
      setMessages([]);
      return;
    }
    
    const path = chatType === "private"
      ? `chats/private/${createChatId(currentUser, selectedChat)}`
      : `chats/group/${selectedChat}`;

    const messagesRef = ref(mockDb, path);
    
    return onValue(messagesRef, snapshot => {
      const data = snapshot.val();
      
      if (!data) {
        setMessages([]);
        return;
      }

      // Convert to array and sort by timestamp
      const msgArray = Object.entries(data)
        .map(([id, msg]) => ({ id, ...msg }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Update read receipts for unread messages
      msgArray.forEach(msg => {
        if (msg.from !== currentUser && (!msg.readBy || !msg.readBy.includes(currentUser))) {
          const updatedReadBy = [...(msg.readBy || []), currentUser];
          update(ref(mockDb, `${path}/${msg.id}`), {
            readBy: updatedReadBy
          });
        }
      });

      setMessages(msgArray);
    });
  }, [currentUser, selectedChat, chatType]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChat || !currentUser) return;
    
    const path = chatType === "private"
      ? `chats/private/${createChatId(currentUser, selectedChat)}`
      : `chats/group/${selectedChat}`;

    // Use timestamp for unique ID to avoid conflicts
    const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    const newEntry = {
      from: currentUser,
      text: newMessage.trim(),
      timestamp: timestamp,
      readBy: [currentUser],
    };
    
    set(ref(mockDb, `${path}/${messageId}`), newEntry);
    setNewMessage("");
  };

  const createGroup = () => {
    const name = prompt("Enter group name");
    if (!name || !name.trim()) return;
    
    // Create a more unique group ID
    const id = `${name.toLowerCase().replace(/\s+/g, "-")}_${Date.now()}`;
    set(ref(mockDb, `groups/${id}`), { 
      name: name.trim(), 
      admin: currentUser, 
      members: [currentUser] 
    });
  };

  const promoteToAdmin = (groupId, userEmail) => {
    if (groups[groupId]?.admin === currentUser) {
      update(ref(mockDb, `groups/${groupId}`), { admin: userEmail });
    }
  };

  const removeMember = (groupId, member) => {
    const group = groups[groupId];
    if (group?.admin === currentUser && group.members) {
      const filtered = group.members.filter(m => m !== member);
      update(ref(mockDb, `groups/${groupId}`), { members: filtered });
    }
  };

  const assignTask = (userEmail) => {
    const task = prompt(`Enter task for ${userEmail}`);
    if (!task || !task.trim()) return;
    
    const encodedUserEmail = encodeEmail(userEmail);
    console.log('Assigning task - original email:', userEmail, 'encoded:', encodedUserEmail);
    
    const taskId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const taskData = {
      task: task.trim(),
      assignedBy: currentUser,
      assignedTo: userEmail,
      status: 'pending',
      timestamp: new Date().toISOString(),
      completedAt: null,
      completedBy: null
    };
    
    const taskPath = `tasks/${encodedUserEmail}/${taskId}`;
    console.log('Task path:', taskPath);
    
    set(ref(mockDb, taskPath), taskData);
    alert(`Task assigned to ${userEmail}`);
  };

  const updateTaskStatus = (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const encodedSelectedChat = encodeEmail(selectedChat);
    const updates = {
      status: newStatus,
      lastModified: new Date().toISOString(),
      lastModifiedBy: currentUser
    };

    if (newStatus === 'completed') {
      updates.completedAt = new Date().toISOString();
      updates.completedBy = currentUser;
    } else {
      updates.completedAt = null;
      updates.completedBy = null;
    }

    update(ref(mockDb, `tasks/${encodedSelectedChat}/${taskId}`), updates);
  };

  const editTask = (taskId, newTaskText) => {
    if (!newTaskText || !newTaskText.trim()) return;

    const encodedSelectedChat = encodeEmail(selectedChat);
    const updates = {
      task: newTaskText.trim(),
      lastModified: new Date().toISOString(),
      lastModifiedBy: currentUser
    };

    update(ref(mockDb, `tasks/${encodedSelectedChat}/${taskId}`), updates);
    setEditingTask(null);
  };

  const deleteTask = (taskId) => {
    if (confirm('Are you sure you want to delete this task?')) {
      const encodedSelectedChat = encodeEmail(selectedChat);
      const taskRef = ref(mockDb, `tasks/${encodedSelectedChat}/${taskId}`);
      set(taskRef, null);
    }
  };

  const handleAuth = () => {
    if (!email || !password) return alert("Please fill in all fields");
    
    if (isRegistering) {
      createUserWithEmailAndPassword(mockAuth, email, password)
        .then((cred) => {
          set(ref(mockDb, `users/${encodeEmail(email)}`), { email });
          setUser({ email });
        })
        .catch(err => alert(err.message));
    } else {
      signInWithEmailAndPassword(mockAuth, email, password)
        .then(() => setUser({ email }))
        .catch(err => alert(err.message));
    }
  };

  // Handle logout
  const handleLogout = () => {
    signOut(mockAuth).then(() => {
      setUser(null);
      setSelectedChat(null);
      setMessages([]);
      setEmail("");
      setPassword("");
    });
  };

  if (!user) {
    return (
      <AuthForm 
        isRegistering={isRegistering}
        setIsRegistering={setIsRegistering}
        handleAuth={handleAuth}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
      />
    );
  }

  return (
    <div style={{ display: 'flex', padding: 20, fontFamily: 'sans-serif', height: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: 300, padding: 20, backgroundColor: '#f5f5f5', borderRadius: 12 }}>
        <h3 style={{ marginTop: 0 }}>{currentUser}</h3>
        <button onClick={handleLogout} style={{ marginBottom: 20 }}>Logout</button>

        <h4>Private Chats</h4>
        {allUsers.map(user => (
          <div key={user} style={{ marginBottom: 8 }}>
            <div 
              onClick={() => { 
                setSelectedChat(user); 
                setChatType("private"); 
              }} 
              style={{ 
                cursor: 'pointer', 
                background: selectedChat === user && chatType === "private" 
                  ? '#ddd' 
                  : 'transparent', 
                padding: 6, 
                borderRadius: 6 
              }}
            >
              {user}
            </div>
            <button 
              onClick={() => assignTask(user)} 
              style={{ fontSize: '0.75rem', marginTop: 2 }}
            >
              Assign Task
            </button>
          </div>
        ))}

        <h4 style={{ marginTop: 20 }}>
          Groups 
          <button onClick={createGroup} style={{ float: 'right' }}>＋</button>
        </h4>
        
        {Object.entries(groups).map(([id, group]) => (
          group.members?.includes(currentUser) && (
            <div key={id} style={{ marginBottom: 12 }}>
              <div 
                onClick={() => { 
                  setSelectedChat(id); 
                  setChatType("group"); 
                }} 
                style={{ 
                  cursor: 'pointer', 
                  background: selectedChat === id && chatType === "group" 
                    ? '#ddd' 
                    : 'transparent', 
                  padding: 6, 
                  borderRadius: 6 
                }}
              >
                {group.name}
              </div>
              
              <GroupAdminControls 
                groupId={id}
                group={group}
                currentUser={currentUser}
                onPromote={promoteToAdmin}
                onRemove={removeMember}
              />
            </div>
          )
        ))}
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, marginLeft: 20, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginTop: 0 }}>
          {selectedChat 
            ? (chatType === 'group' 
                ? `Group: ${groups[selectedChat]?.name || selectedChat}` 
                : `Chat with ${selectedChat}`) 
            : 'Select a chat to start messaging'}
        </h3>
        
        {/* Tab Navigation - Only show for private chats */}
        {selectedChat && chatType === 'private' && (
          <div style={{ 
            display: 'flex', 
            marginBottom: 10, 
            borderBottom: '1px solid #ccc' 
          }}>
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                padding: '8px 16px',
                backgroundColor: activeTab === 'chat' ? '#007bff' : 'transparent',
                color: activeTab === 'chat' ? 'white' : '#007bff',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0'
              }}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              style={{
                padding: '8px 16px',
                backgroundColor: activeTab === 'tasks' ? '#007bff' : 'transparent',
                color: activeTab === 'tasks' ? 'white' : '#007bff',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
                marginLeft: 4
              }}
            >
              Tasks ({tasks.length})
            </button>
          </div>
        )}
        
        {/* Chat Tab Content */}
        {(!selectedChat || chatType === 'group' || activeTab === 'chat') && (
          <>
            <div style={{ 
              height: 400, 
              overflowY: 'auto', 
              border: '1px solid #ccc', 
              padding: 15, 
              borderRadius: 10, 
              backgroundColor: '#fff',
              flex: 1
            }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#666', marginTop: 50 }}>
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    style={{ 
                      marginBottom: 15, 
                      padding: 10, 
                      backgroundColor: msg.from === currentUser 
                        ? '#dcf8c6' 
                        : '#f1f0f0', 
                      borderRadius: 8,
                      alignSelf: msg.from === currentUser ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
                      {new Date(msg.timestamp).toLocaleString()}
                    </div>
                    <div>
                      <strong>{msg.from}:</strong> {msg.text}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 4 }}>
                      {msg.readBy?.length > 1 
                        ? `Read by ${msg.readBy.filter(r => r !== msg.from).join(', ')}` 
                        : msg.from === currentUser ? 'Sent' : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {selectedChat && (
              <div style={{ display: 'flex', marginTop: 10 }}>
                <textarea 
                  rows={2} 
                  placeholder="Type a message..." 
                  style={{ 
                    flex: 1, 
                    padding: 10, 
                    borderRadius: 8, 
                    border: '1px solid #ccc',
                    resize: 'vertical'
                  }} 
                  value={newMessage} 
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyPress={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button 
                  onClick={handleSendMessage} 
                  style={{ 
                    marginLeft: 10, 
                    padding: '10px 20px', 
                    borderRadius: 8,
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Send
                </button>
              </div>
            )}
          </>
        )}
        
        {/* Tasks Tab Content */}
        {activeTab === 'tasks' && selectedChat && chatType === 'private' && (
          <div style={{ 
            height: 400, 
            overflowY: 'auto', 
            border: '1px solid #ccc', 
            padding: 15, 
            borderRadius: 10, 
            backgroundColor: '#fff',
            flex: 1
          }}>
            <div style={{ marginBottom: 15 }}>
              <button
                onClick={() => assignTask(selectedChat)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Assign New Task
              </button>
            </div>
            
            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', marginTop: 50 }}>
                No tasks assigned yet.
              </div>
            ) : (
              <>
                {/* Pending Tasks */}
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ color: '#dc3545', marginBottom: 10 }}>
                    Pending Tasks ({tasks.filter(t => t.status === 'pending').length})
                  </h4>
                  {tasks.filter(t => t.status === 'pending').map(task => (
                    <div key={task.id} style={{
                      backgroundColor: '#fff3cd',
                      border: '1px solid #ffeaa7',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          {editingTask === task.id ? (
                            <div>
                              <textarea
                                value={task.task}
                                onChange={e => {
                                  const updatedTasks = tasks.map(t => 
                                    t.id === task.id ? { ...t, task: e.target.value } : t
                                  );
                                  setTasks(updatedTasks);
                                }}
                                style={{
                                  width: '100%',
                                  padding: 8,
                                  border: '1px solid #ccc',
                                  borderRadius: 4,
                                  resize: 'vertical'
                                }}
                                rows={2}
                              />
                              <div style={{ marginTop: 8 }}>
                                <button
                                  onClick={() => editTask(task.id, task.task)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    marginRight: 8
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingTask(null)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <strong>{task.task}</strong>
                              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
                                Assigned by: {task.assignedBy}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                Created: {new Date(task.timestamp).toLocaleString()}
                              </div>
                              {task.lastModified && (
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                  Modified: {new Date(task.lastModified).toLocaleString()} by {task.lastModifiedBy}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {editingTask !== task.id && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                              }}
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => setEditingTask(task.id)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#ffc107',
                                color: 'black',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Completed Tasks */}
                <div>
                  <h4 style={{ color: '#28a745', marginBottom: 10 }}>
                    Completed Tasks ({tasks.filter(t => t.status === 'completed').length})
                  </h4>
                  {tasks.filter(t => t.status === 'completed').map(task => (
                    <div key={task.id} style={{
                      backgroundColor: '#d4edda',
                      border: '1px solid #c3e6cb',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <strong>{task.task}</strong>
                          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
                            Assigned by: {task.assignedBy}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>
                            Created: {new Date(task.timestamp).toLocaleString()}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#28a745' }}>
                            Completed: {new Date(task.completedAt).toLocaleString()} by {task.completedBy}
                          </div>
                          {task.lastModified && task.lastModified !== task.completedAt && (
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                              Modified: {new Date(task.lastModified).toLocaleString()} by {task.lastModifiedBy}
                            </div>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => updateTaskStatus(task.id, 'pending')}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#ffc107',
                              color: 'black',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            Reopen
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}