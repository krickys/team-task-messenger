import { useEffect, useState } from 'react';
import { 
  getDatabase, 
  ref, 
  set, 
  update, 
  onValue,
  push
} from 'firebase/database';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
// Import your Firebase app configuration
import { app } from './firebase.js'; // Adjust path if needed

// Initialize Firebase services
const database = getDatabase(app);
const auth = getAuth(app);

// FIXED utility functions - RESOLVES FIREBASE PATH ERROR!
const encodeEmail = (email) => {
  if (!email) return '';
  console.log('🔧 ENCODING EMAIL:', email);
  
  // Replace Firebase invalid characters with safe alternatives
  const encoded = email
    .replace(/\./g, '_dot_')      // Replace . with _dot_
    .replace(/@/g, '_at_')        // Replace @ with _at_  
    .replace(/#/g, '_hash_')      // Replace # with _hash_
    .replace(/\$/g, '_dollar_')   // Replace $ with _dollar_
    .replace(/\[/g, '_lbracket_') // Replace [ with _lbracket_
    .replace(/\]/g, '_rbracket_'); // Replace ] with _rbracket_
  
  console.log('✅ ENCODED RESULT:', encoded);
  return encoded;
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
  const [activeTab, setActiveTab] = useState("chat");
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentUser = user?.email;

  // Authentication state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        console.log("✅ User authenticated:", u.email);
      }
    });
    return () => unsubscribe();
  }, []);

  // Users listener
  useEffect(() => {
    if (!currentUser) return;
    
    const usersRef = ref(database, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const users = Object.values(data)
          .map(u => u.email)
          .filter(e => e !== currentUser);
        setAllUsers(users);
        console.log("👥 Loaded users:", users);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Groups listener
  useEffect(() => {
    if (!currentUser) return;
    
    const groupsRef = ref(database, "groups");
    const unsubscribe = onValue(groupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGroups(data);
        console.log("👥 Loaded groups:", Object.keys(data));
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Tasks listener
  useEffect(() => {
    if (!currentUser || !selectedChat || chatType !== "private") {
      setTasks([]);
      return;
    }
    
    const encodedSelectedChat = encodeEmail(selectedChat);
    console.log('📋 Tasks listener - encoded chat:', encodedSelectedChat);
    
    const tasksRef = ref(database, `tasks/${encodedSelectedChat}`);
    const unsubscribe = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const taskArray = Object.entries(data)
          .map(([id, task]) => ({ id, ...task }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTasks(taskArray);
        console.log(`📋 Loaded ${taskArray.length} tasks for ${selectedChat}`);
      } else {
        setTasks([]);
      }
    });
    return () => unsubscribe();
  }, [currentUser, selectedChat, chatType]);

  // Messages listener
  useEffect(() => {
    if (!currentUser || !selectedChat) {
      setMessages([]);
      return;
    }
    
    const path = chatType === "private"
      ? `chats/private/${createChatId(currentUser, selectedChat)}`
      : `chats/group/${selectedChat}`;

    const messagesRef = ref(database, path);
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      
      if (!data) {
        setMessages([]);
        return;
      }

      const msgArray = Object.entries(data)
        .map(([id, msg]) => ({ id, ...msg }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Update read receipts for unread messages
      msgArray.forEach(msg => {
        if (msg.from !== currentUser && (!msg.readBy || !msg.readBy.includes(currentUser))) {
          const updatedReadBy = [...(msg.readBy || []), currentUser];
          const messageRef = ref(database, `${path}/${msg.id}`);
          update(messageRef, {
            readBy: updatedReadBy
          }).catch(console.error);
        }
      });

      setMessages(msgArray);
    });
    return () => unsubscribe();
  }, [currentUser, selectedChat, chatType]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !currentUser) return;
    
    setLoading(true);
    try {
      const path = chatType === "private"
        ? `chats/private/${createChatId(currentUser, selectedChat)}`
        : `chats/group/${selectedChat}`;

      const messagesRef = ref(database, path);
      const timestamp = new Date().toISOString();
      
      const newEntry = {
        from: currentUser,
        text: newMessage.trim(),
        timestamp: timestamp,
        readBy: [currentUser],
      };
      
      await push(messagesRef, newEntry);
      setNewMessage("");
      console.log("💬 Message sent successfully");
    } catch (error) {
      console.error("❌ Error sending message:", error);
      alert("Failed to send message: " + error.message);
    }
    setLoading(false);
  };

  const createGroup = async () => {
    const name = prompt("Enter group name");
    if (!name || !name.trim()) return;
    
    setLoading(true);
    try {
      const id = `${name.toLowerCase().replace(/\s+/g, "-")}_${Date.now()}`;
      const groupRef = ref(database, `groups/${id}`);
      await set(groupRef, { 
        name: name.trim(), 
        admin: currentUser, 
        members: [currentUser] 
      });
      console.log("👥 Group created:", name);
    } catch (error) {
      console.error("❌ Error creating group:", error);
      alert("Failed to create group: " + error.message);
    }
    setLoading(false);
  };

  const promoteToAdmin = async (groupId, userEmail) => {
    if (groups[groupId]?.admin !== currentUser) return;
    
    try {
      const groupRef = ref(database, `groups/${groupId}`);
      await update(groupRef, { admin: userEmail });
      console.log("👑 Promoted to admin:", userEmail);
    } catch (error) {
      console.error("❌ Error promoting user:", error);
      alert("Failed to promote user: " + error.message);
    }
  };

  const removeMember = async (groupId, member) => {
    const group = groups[groupId];
    if (group?.admin !== currentUser || !group.members) return;
    
    try {
      const filtered = group.members.filter(m => m !== member);
      const groupRef = ref(database, `groups/${groupId}`);
      await update(groupRef, { members: filtered });
      console.log("🚫 Removed member:", member);
    } catch (error) {
      console.error("❌ Error removing member:", error);
      alert("Failed to remove member: " + error.message);
    }
  };

  const assignTask = async (userEmail) => {
    const task = prompt(`Enter task for ${userEmail}`);
    if (!task || !task.trim()) return;
    
    setLoading(true);
    try {
      const encodedUserEmail = encodeEmail(userEmail);
      console.log('📋 Assigning task - original email:', userEmail, 'encoded:', encodedUserEmail);
      
      const taskData = {
        task: task.trim(),
        assignedBy: currentUser,
        assignedTo: userEmail,
        status: 'pending',
        timestamp: new Date().toISOString(),
        completedAt: null,
        completedBy: null
      };
      
      const tasksRef = ref(database, `tasks/${encodedUserEmail}`);
      await push(tasksRef, taskData);
      
      console.log("✅ Task assigned successfully");
      alert(`Task assigned to ${userEmail}`);
    } catch (error) {
      console.error("❌ Error assigning task:", error);
      alert("Failed to assign task: " + error.message);
    }
    setLoading(false);
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
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

      const taskRef = ref(database, `tasks/${encodedSelectedChat}/${taskId}`);
      await update(taskRef, updates);
      console.log("📋 Task status updated:", newStatus);
    } catch (error) {
      console.error("❌ Error updating task:", error);
      alert("Failed to update task: " + error.message);
    }
  };

  const editTask = async (taskId, newTaskText) => {
    if (!newTaskText || !newTaskText.trim()) return;

    try {
      const encodedSelectedChat = encodeEmail(selectedChat);
      const updates = {
        task: newTaskText.trim(),
        lastModified: new Date().toISOString(),
        lastModifiedBy: currentUser
      };

      const taskRef = ref(database, `tasks/${encodedSelectedChat}/${taskId}`);
      await update(taskRef, updates);
      setEditingTask(null);
      console.log("📝 Task edited successfully");
    } catch (error) {
      console.error("❌ Error editing task:", error);
      alert("Failed to edit task: " + error.message);
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const encodedSelectedChat = encodeEmail(selectedChat);
      const taskRef = ref(database, `tasks/${encodedSelectedChat}/${taskId}`);
      await set(taskRef, null);
      console.log("🗑️ Task deleted successfully");
    } catch (error) {
      console.error("❌ Error deleting task:", error);
      alert("Failed to delete task: " + error.message);
    }
  };

  const handleAuth = async () => {
    if (!email || !password) return alert("Please fill in all fields");
    
    setLoading(true);
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Save user to database
        const userRef = ref(database, `users/${encodeEmail(email)}`);
        await set(userRef, { email });
        console.log("✅ User registered:", email);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ User signed in:", email);
      }
    } catch (error) {
      console.error("❌ Auth error:", error);
      alert(error.message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSelectedChat(null);
      setMessages([]);
      setEmail("");
      setPassword("");
      console.log("👋 User signed out");
    } catch (error) {
      console.error("❌ Logout error:", error);
    }
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
      {loading && (
        <div style={{ 
          position: 'fixed', 
          top: 10, 
          right: 10, 
          background: '#007bff', 
          color: 'white', 
          padding: '8px 16px', 
          borderRadius: 4,
          zIndex: 1000
        }}>
          Loading...
        </div>
      )}
      
      <div style={{ width: 300, padding: 20, backgroundColor: '#f5f5f5', borderRadius: 12 }}>
        <h3 style={{ marginTop: 0 }}>{currentUser}</h3>
        <button onClick={handleLogout} style={{ marginBottom: 20 }} disabled={loading}>
          Logout
        </button>

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
              disabled={loading}
            >
              Assign Task
            </button>
          </div>
        ))}

        <h4 style={{ marginTop: 20 }}>
          Groups 
          <button onClick={createGroup} style={{ float: 'right' }} disabled={loading}>
            ＋
          </button>
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

      <div style={{ flex: 1, marginLeft: 20, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginTop: 0 }}>
          {selectedChat 
            ? (chatType === 'group' 
                ? `Group: ${groups[selectedChat]?.name || selectedChat}` 
                : `Chat with ${selectedChat}`) 
            : 'Select a chat to start messaging'}
        </h3>
        
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
                  disabled={loading}
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
                  disabled={loading}
                >
                  Send
                </button>
              </div>
            )}
          </>
        )}
        
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
                disabled={loading}
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