const express = require('express');
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require("nodemailer");
const fs = require('fs');
const path = require('path');
const jwt = require("jsonwebtoken");
const AutoIncrement = require('mongoose-sequence')(mongoose);
const app = express();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const server = http.createServer(app);
const io = new Server(server);

const genAI = new GoogleGenerativeAI("API_KEY");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const PORT = 5000;
//cwpx rxsn ilsp wcql

// MongoDB connection URI
const MONGO_URI = 'mongodb://localhost:27017/signupDB';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "saad.66loop@gmail.com",
        pass: "iolelytrroaxmrcu", // Consider using environment variables for security
    },
});
cloudinary.config({
    cloud_name: "dawajxqa6", // Replace with your Cloudinary cloud name
    api_key: "API_KEY", // Replace with your Cloudinary API key
    api_secret: "API_SECRET", // Replace with your Cloudinary API secret
});
// Define a schema for signup data
const userSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    dob: { type: Date, required: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
});

// Define a schema for Classes
const classesSchema = new mongoose.Schema({
    classname: { type: String, required: true },
    desc: { type: String, required: true },
    classcode: { type: Number }, // Auto-incremented field
});

const privateClassroomSchema = new mongoose.Schema({
    userid: { type: String, required: true },
    useremail: { type: String, required: true },
    classroomid: { type: String, required: true },
    privateclassroomname: { type: String, required: true },
    privateclassroompassword: { type: String, required: true },
});

const chatSchema = new mongoose.Schema({
    privateclassroomid: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }, // Automatically adds the current time
});

const announcementSchema = new mongoose.Schema({
    privateclassroomid: { type: String, required: true },
    email: { type: String, required: true }, // The email of the user creating the announcement
    announcementdata: { type: String, required: true }, // The actual announcement content
    timestamp: { type: Date, default: Date.now }, // Auto-generated timestamp
});

const assignmentSchema = new mongoose.Schema({
    privateclassroomid: { type: String, required: true },
    email: { type: String, required: true }, // The email of the user who created the assignment
    title: { type: String, required: true }, // Assignment title
    desc: { type: String, required: true }, // Assignment description
    duedate: { type: Date, required: true }, // Due date for the assignment
    createdAt: { type: Date, default: Date.now }, // Auto-generated creation timestamp
});

const assignmentSubmissionSchema = new mongoose.Schema({
    assignmentid: { type: String, required: true },
    email: { type: String, required: true },
    description: { type: String, required: true },
    base64string: { type: String, required: true },  // Store the base64 string as normal text
    filetype: { type: String, required: true },      // Store the file type (e.g., 'application/pdf', 'image/jpeg')
    timestamp: { type: Date, default: Date.now },     // Automatically set the timestamp when the document is created
});

const noteSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    fileUrl: { type: String, required: false },
    fileType: { type: String, required: false },
    classroomid: { type: String, required: true },
    email: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});


const Note = mongoose.model('Note', noteSchema);

const AssignmentSubmission = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);


const Assignment = mongoose.model("Assignment", assignmentSchema);

const Announcement = mongoose.model("Announcement", announcementSchema);


const Chat = mongoose.model('Chat', chatSchema);


// Add auto-increment plugin to `classcode`
classesSchema.plugin(AutoIncrement, { inc_field: 'classcode' });

// Create a model for the schema
const Class = mongoose.model('Class', classesSchema);

// Create a model for the schema
const User = mongoose.model('User', userSchema);

const PrivateClassroom = mongoose.model("PrivateClassroom", privateClassroomSchema);


const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // Determine the resource type based on the file MIME type
        const isRawFile = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype);

        return {
            folder: 'notes', // Folder name in Cloudinary
            resource_type: isRawFile ? 'raw' : 'auto', // Use 'raw' for PDFs, DOCX; 'auto' for images
            allowed_formats: ['jpg', 'png', 'pdf', 'docx'], // Allowable file types
        };
    },
});

const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(bodyParser.json());

app.post("/signup", async (req, res) => {
    const { fullname, email, dob, password } = req.body;
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        console.log("Inside API");


        // Create a new user in MongoDB
        const newUser = new User({ fullname, email, dob, password });
        await newUser.save();

        // Create a JWT token for email verification
        const token = jwt.sign({ email: newUser.email }, "secret", { expiresIn: "1h" });
        console.log("Sending Email to:", newUser.email);

        // Send verification email using async/await
        const mailOptions = {
            from: "saad.66loop@gmail.com",
            to: newUser.email,
            subject: "Verify your email address",
            html: `<h3>Welcome ${newUser.fullname}!</h3>
                <p>Please verify your email address by clicking the link below:</p>
                <a href="https://f918-119-73-112-44.ngrok-free.app/verify-email/${token}">Verify Email</a>`,
        };

        // Using promise for sending mail
        const sendMailPromise = new Promise((resolve, reject) => {
            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(info);
                }
            });
        });

        // Wait for the email to be sent
        await sendMailPromise;

        // Respond to the user once email is sent
        return res.status(201).json({ message: "Signup successful! Check your email for verification." });

    } catch (error) {
        console.error("Error during signup:", error);
        return res.status(500).json({ message: "Error during signup" });
    }
});

// Email verification route
app.get("/verify-email/:token", async (req, res) => {
    const { token } = req.params;

    try {
        const decoded = jwt.verify(token, "secret");
        const email = decoded.email;

        // Mark user as verified in the database
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid verification link" });
        }

        user.isVerified = true;
        await user.save();

        res.status(200).send("Email verified successfully!");
    } catch (error) {
        console.error("Error verifying email:", error);
        res.status(500).json({ message: "Invalid or expired verification token" });
    }
});// API to handle login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the email exists in the database
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Email does not exist' });
        }
        if (user.isVerified === false) {
            return res.status(202).json({ message: 'Please Verify Your Email First' });
        }

        // Check if the password matches
        if (user.password !== password) {
            console.log('Incorrect password');
            return res.status(202).json({ message: 'Incorrect password' });
        }
        // Both email and password are correct
        res.status(200).json({ message: 'Login successful', data: user });
        console.log('User logged in:', user);
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Error during login', error: err.message });
    }
});

// API to add a new class
app.post('/addClass', async (req, res) => {
    const { classname, desc } = req.body;

    try {
        // Validate request data
        if (!classname || !desc) {
            return res.status(400).json({ message: 'Classname and description are required' });
        }

        // Create a new class document
        const newClass = new Class({ classname, desc });

        // Save the document to MongoDB
        const savedClass = await newClass.save();

        console.log('Class saved:', savedClass);
        res.status(201).json({
            message: 'Class created successfully',
            data: savedClass,
        });
    } catch (err) {
        console.error('Error creating class:', err);
        res.status(500).json({ message: 'Error creating class', error: err.message });
    }
});
// API to fetch all classes
app.post('/fetchClass', async (req, res) => {
    console.log('Fetching all classes...');
    try {
        // Fetch all class documents from the database
        const classes = await Class.find();

        console.log('Fetched classes:', classes);
        res.status(200).json(classes); // Send the classes as a JSON response
    } catch (err) {
        console.error('Error fetching classes:', err);
        res.status(500).json({ message: 'Error fetching classes', error: err.message });
    }
});
app.post('/createPrivateClassroom', async (req, res) => {
    const { userid, useremail, classroomid, privateclassroomname, privateclassroompassword } = req.body;
    console.log(req.body);
    try {
        // Create a new PrivateClassroom document
        const existingPrivateClassroom = await PrivateClassroom.findOne({
            privateclassroomname
        })

        if (existingPrivateClassroom) {
            return res.status(400).json({ message: 'Private classroom already exists' });
        }

        const newPrivateClassroom = new PrivateClassroom({
            userid,
            useremail,
            classroomid,
            privateclassroomname,
            privateclassroompassword,
        });

        //Save the document to MongoDB
        await newPrivateClassroom.save();

        console.log('Private classroom saved:', newPrivateClassroom);
        res.status(201).json({ message: 'Private classroom created successfully', data: newPrivateClassroom });
    } catch (err) {
        console.error('Error saving private classroom:', err);
        res.status(500).json({ message: 'Error creating private classroom', error: err.message });
    }
});
// API to fetch all private classrooms for a given classroomid
app.post('/getPrivateClassrooms', async (req, res) => {
    const { classroomid, userid } = req.body;
    console.log('Classroom ID:', classroomid);
    console.log('User ID:', userid);

    try {
        // Find all private classrooms with the given classroomid where userid does not match
        const privateClassrooms = await PrivateClassroom.find({
            classroomid,
            userid: { $ne: userid }, // Filter where userid is not equal to the provided userid
        });

        if (privateClassrooms.length === 0) {
            return res
                .status(404)
                .json({ message: 'No private classrooms found for the given classroom ID and user ID' });
        }

        console.log('Fetched private classrooms:', privateClassrooms);
        res.status(200).json({ message: 'Private classrooms fetched successfully', data: privateClassrooms });
    } catch (err) {
        console.error('Error fetching private classrooms:', err);
        res.status(500).json({ message: 'Error fetching private classrooms', error: err.message });
    }
});

app.post('/getUserPrivateClassrooms', async (req, res) => {
    const { classroomid, userid } = req.body;

    console.log('Classroom ID:', classroomid);
    console.log('User ID:', userid);

    try {
        // Find private classrooms where both classroomid and userid match
        const privateClassrooms = await PrivateClassroom.find({
            classroomid,
            userid,
        });

        if (privateClassrooms.length === 0) {
            return res
                .status(404)
                .json({ message: 'No private classrooms found for the given classroom ID and user ID' });
        }

        console.log('Fetched private classrooms:', privateClassrooms);
        res.status(200).json({
            message: 'Private classrooms fetched successfully',
            data: privateClassrooms,
        });
    } catch (err) {
        console.error('Error fetching private classrooms:', err);
        res.status(500).json({
            message: 'Error fetching private classrooms',
            error: err.message,
        });
    }
});
async function RenerateAIResponse(prompt, privateclassroomid) {
    var aiPrompt = prompt.replace('@AI-Gen', '').trim();
    aiPrompt = aiPrompt + " Keep your answer under 50 words"

    // Assuming generateContent returns the response object
    const response = await model.generateContent(aiPrompt);

    // Extract the message text from the response
    let message = "Unable to generate response.";

    const response2 = await response.response;
    message = response2.text();

    const email = "AI GENERATED RESPONSE";
    const newChat = new Chat({
        email,
        privateclassroomid,
        message, // Save the extracted message
    });

    await newChat.save();
}


app.post('/sendMessage', async (req, res) => {
    const { email, privateclassroomid, message } = req.body;

    if (!email || !privateclassroomid || !message) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        // Create a new chat document
        const newChat = new Chat({
            email,
            privateclassroomid,
            message,
        });

        // Save the document to the database
        await newChat.save();
        if (message.includes('@AI-Gen')) {
            await RenerateAIResponse(message, privateclassroomid);

        }
        //console.log('Message saved:', newChat);
        res.status(201).json({
            message: 'Message sent successfully',
            chatId: newChat._id,
        });
    } catch (err) {
        console.error('Error saving chat message:', err);
        res.status(500).json({
            message: 'Error saving chat message',
            error: err.message,
        });
    }
});


app.post('/fetchChats', async (req, res) => {
    const { privateclassroomid } = req.body;

    try {

        // Fetch chats with the given privateclassroomid
        const chats = await Chat.find({ privateclassroomid });

        if (chats.length === 0) {
            return res.status(404).json({ message: "No chats found for the given PrivateClassroomID" });
        }

        res.status(200).json({
            message: "Chats fetched successfully",
            data: chats,
        });
    } catch (error) {
        console.error("Error fetching chats:", error);
        res.status(500).json({
            message: "Error fetching chats",
            error: error.message,
        });
    }
});
app.post('/createAnnouncement', async (req, res) => {
    const { privateclassroomid, announcementdata, email } = req.body;

    try {
        // Validate required fields
        if (!privateclassroomid || !announcementdata || !email) {
            return res.status(400).json({ message: "All fields are required: privateclassroomid, announcementdata, email" });
        }

        // Create a new announcement document
        const newAnnouncement = new Announcement({
            privateclassroomid,
            announcementdata,
            email,
        });

        // Save the announcement to the database
        await newAnnouncement.save();

        //console.log("Announcement created:", newAnnouncement);
        res.status(201).json({ message: "Announcement created successfully", data: newAnnouncement });
    } catch (error) {
        console.error("Error creating announcement:", error);
        res.status(500).json({ message: "Error creating announcement", error: error.message });
    }
});
app.post('/getAnnouncements', async (req, res) => {
    const { privateclassroomid } = req.body;

    try {
        // Validate input
        if (!privateclassroomid) {
            return res.status(400).json({ message: "Private Classroom ID is required" });
        }

        // Find all announcements with the given privateclassroomid
        const announcements = await Announcement.find({ privateclassroomid });

        if (announcements.length === 0) {
            return res.status(404).json({ message: "No announcements found for the given Private Classroom ID" });
        }

        //console.log("Fetched announcements:", announcements);
        res.status(200).json({ message: "Announcements fetched successfully", data: announcements });
    } catch (error) {
        console.error("Error fetching announcements:", error);
        res.status(500).json({ message: "Error fetching announcements", error: error.message });
    }
});
app.post('/createAssignment', async (req, res) => {
    const { privateclassroomid, email, title, desc, duedate } = req.body;

    try {
        // Validate input
        if (!privateclassroomid || !email || !title || !desc || !duedate) {
            return res.status(400).json({ message: "All fields are required: privateclassroomid, email, title, desc, duedate" });
        }

        // Create a new assignment document
        const newAssignment = new Assignment({
            privateclassroomid,
            email,
            title,
            desc,
            duedate,
        });

        // Save the assignment to the database
        await newAssignment.save();

        //console.log("Assignment created:", newAssignment);
        res.status(201).json({ message: "Assignment created successfully", data: newAssignment });
    } catch (error) {
        console.error("Error creating assignment:", error);
        res.status(500).json({ message: "Error creating assignment", error: error.message });
    }
});
app.post('/getAssignments', async (req, res) => {
    const { privateclassroomid } = req.body;

    try {
        // Validate input
        if (!privateclassroomid) {
            return res.status(400).json({ message: "Private Classroom ID is required" });
        }

        // Find all assignments with the given privateclassroomid
        const assignments = await Assignment.find({ privateclassroomid });

        if (assignments.length === 0) {
            return res.status(404).json({ message: "No assignments found for the given Private Classroom ID" });
        }

        //console.log("Fetched assignments:", assignments);
        res.status(200).json({ message: "Assignments fetched successfully", data: assignments });
    } catch (error) {
        console.error("Error fetching assignments:", error);
        res.status(500).json({ message: "Error fetching assignments", error: error.message });
    }
});

app.post('/submitAssignment', async (req, res) => {
    const { assignmentid, base64string, email, description, filetype } = req.body;

    // Check for required fields
    if (!base64string || !email || !description) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        // Create a new assignment submission document
        const newSubmission = new AssignmentSubmission({
            assignmentid,
            email,
            description,
            base64string,  // Store the base64 string as normal text
            filetype,      // Store the filetype (e.g., 'image/jpeg', 'application/pdf', etc.)
        });

        // Save the document to MongoDB
        await newSubmission.save();

        //console.log('Assignment submitted:', { assignmentid, email });
        res.status(201).json({ message: 'Assignment submitted successfully' });
    } catch (err) {
        console.error('Error saving assignment submission:', err);
        res.status(500).json({ message: 'Error saving assignment', error: err.message });
    }
});
app.post('/getSubmissions', async (req, res) => {
    const { assignmentid } = req.body;

    if (!assignmentid) {
        return res.status(400).json({ message: 'Assignment ID is required' });
    }

    try {
        // Find all submissions that match the assignmentid
        const submissions = await AssignmentSubmission.find({ assignmentid });

        if (submissions.length === 0) {
            return res.status(404).json({ message: 'No submissions found for this assignment' });
        }

        // Send the found submissions as a JSON response
        res.status(200).json({
            message: 'Submissions fetched successfully',
            data: submissions
        });
    } catch (err) {
        console.error('Error fetching submissions:', err);
        res.status(500).json({ message: 'Error fetching submissions', error: err.message });
    }
});

app.delete('/deleteAssignmentSubmission', async (req, res) => {
    const { assignmentSubmissionId } = req.body;  // Expecting the ID to be sent in the request body

    if (!assignmentSubmissionId) {
        return res.status(400).json({ message: 'Assignment Submission ID is required' });
    }

    try {
        // Find and remove the document by ID
        const deletedSubmission = await AssignmentSubmission.findByIdAndDelete(assignmentSubmissionId);

        if (!deletedSubmission) {
            return res.status(404).json({ message: 'Assignment submission not found' });
        }

        //console.log('Deleted assignment submission:', deletedSubmission);
        res.status(200).json({ message: 'Assignment submission deleted successfully', data: deletedSubmission });
    } catch (err) {
        console.error('Error deleting assignment submission:', err);
        res.status(500).json({ message: 'Error deleting assignment submission', error: err.message });
    }
});
app.put('/updateUserDetails', async (req, res) => {
    const { email, fullname, dob, password } = req.body;

    // Validate request data
    if (!email) {
        return res.status(400).json({ message: 'Email is required to update user details' });
    }

    try {
        // Find the user by email and update the details
        const updatedUser = await User.findOneAndUpdate(
            { email }, // Query to find the user by email
            { $set: { fullname, dob, password } }, // Fields to update
            { new: true, runValidators: true } // Return the updated document and validate data
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found with the given email' });
        }

        console.log('Updated user details:', updatedUser);
        res.status(200).json({ message: 'User details updated successfully', data: updatedUser });
    } catch (err) {
        console.error('Error updating user details:', err);
        res.status(500).json({ message: 'Error updating user details', error: err.message });
    }
});
app.post('/notes', upload.single('file'), async (req, res) => {
    try {
        const { title, content } = req.body;
        const newNote = new Note({
            title,
            content,
            fileUrl: req.file ? req.file.path : null,
            fileType: req.file ? req.file.mimetype : null,
            classroomid: req.body.classroomid,
            email: req.body.email
        });
        await newNote.save();
        res.status(201).json({ message: 'Note created successfully', note: newNote });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create note', details: err.message });
    }
});

app.post('/getnotes', async (req, res) => {
    try {
        const notes = await Note.find();
        res.status(200).json(notes);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});





// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
