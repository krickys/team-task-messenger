// Firebase Path Sanitization Functions
function sanitizeEmailForFirebase(email) {
    return email
        .replace(/\./g, '_dot_')   // Replace . with _dot_
        .replace(/@/g, '_at_');    // Replace @ with _at_
}

function desanitizeEmailFromFirebase(sanitizedEmail) {
    return sanitizedEmail
        .replace(/_dot_/g, '.')    // Convert back to .
        .replace(/_at_/g, '@');    // Convert back to @
}

// Updated assignTask function
function assignTask(taskId, assigneeEmail, taskData) {
    const sanitizedEmail = sanitizeEmailForFirebase(assigneeEmail);
    const taskRef = firebase.database().ref(`tasks/${sanitizedEmail}/${taskId}`);
    
    return taskRef.set({
        ...taskData,
        assigneeEmail: assigneeEmail, // Store original email in the data
        assignedAt: Date.now(),
        taskId: taskId
    }).then(() => {
        console.log(`Task ${taskId} assigned to ${assigneeEmail} successfully`);
        return { success: true, taskId, assigneeEmail };
    }).catch(error => {
        console.error('Error assigning task:', error);
        throw error;
    });
}

// Helper function to retrieve tasks by user email
function getTasksByUserEmail(userEmail) {
    const sanitizedEmail = sanitizeEmailForFirebase(userEmail);
    return firebase.database().ref(`tasks/${sanitizedEmail}`).once('value')
        .then(snapshot => {
            const tasks = [];
            snapshot.forEach(child => {
                tasks.push({
                    id: child.key,
                    ...child.val()
                });
            });
            return tasks;
        });
}

// Helper function to update task status
function updateTaskStatus(taskId, assigneeEmail, status) {
    const sanitizedEmail = sanitizeEmailForFirebase(assigneeEmail);
    const taskRef = firebase.database().ref(`tasks/${sanitizedEmail}/${taskId}`);
    
    return taskRef.update({
        status: status,
        updatedAt: Date.now()
    });
}

// Example usage:
/*
// Create a new task
const taskData = {
    title: "Design homepage layout",
    description: "Create a modern, responsive homepage",
    priority: "high",
    dueDate: "2024-01-15",
    status: "pending"
};

// Assign the task
assignTask("1752043749651", "sourabhsharma.rias@gmail.com", taskData)
    .then(result => {
        console.log("Task assigned successfully:", result);
    })
    .catch(error => {
        console.error("Failed to assign task:", error);
    });

// Retrieve tasks for a user
getTasksByUserEmail("sourabhsharma.rias@gmail.com")
    .then(tasks => {
        console.log("User tasks:", tasks);
    });

// Update task status
updateTaskStatus("1752043749651", "sourabhsharma.rias@gmail.com", "completed")
    .then(() => {
        console.log("Task status updated");
    });
*/