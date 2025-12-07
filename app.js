/* 

================== Most Important ==================
* Issue 1 :
In uploads folder you need create 3 folder like bellow.
Folder structure will be like: 
public -> uploads -> 1. products 2. customize 3. categories
*** Now This folder will automatically create when we run the server file

* Issue 2:
For admin signup just go to the auth 
controller then newUser obj, you will 
find a role field. role:1 for admin signup & 
role: 0 or by default it for customer signup.
go user model and see the role field.

*/

const express = require("express");
const app = express();
require("dotenv").config();
const mongoose = require("mongoose");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const cors = require("cors");

// Import Router
const authRouter = require("./routes/auth");
const categoryRouter = require("./routes/categories");
const productRouter = require("./routes/products");
const orderRouter = require("./routes/orders");
const usersRouter = require("./routes/users");
const customizeRouter = require("./routes/customize");
// Import Auth middleware for check user login or not~
const { loginCheck } = require("./middleware/auth");
const CreateAllFolder = require("./config/uploadFolderCreateScript");

/* Create All Uploads Folder if not exists | For Uploading Images */
CreateAllFolder();

// Database Connection
if (!process.env.DATABASE) {
  console.error("ERROR: DATABASE environment variable is not set!");
  console.error("Please check your .env file");
} else {
  mongoose
    .connect(process.env.DATABASE, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
    })
    .then(() =>
      console.log(
        "==============Mongodb Database Connected Successfully=============="
      )
    )
    .catch((err) => {
      console.error("Database Not Connected !!!");
      console.error("Error:", err.message);
      if (err.message.includes("authentication")) {
        console.error("⚠️  Authentication failed. Please check username and password.");
      }
    });
}

// Middleware
app.use(morgan("dev"));
app.use(cookieParser());
app.use(cors({
  origin: [
    'http://localhost:3000'
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Disable cache for API routes to prevent 304 responses
app.use("/api", (req, res, next) => {
  // Remove conditional request headers to force fresh response
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];
  
  // Remove ETag header if present
  res.removeHeader("ETag");
  
  // Set no-cache headers
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store",
    "Last-Modified": new Date().toUTCString()
  });
  next();
});

// Routes
app.use("/api", authRouter);
app.use("/api/user", usersRouter);
app.use("/api/category", categoryRouter);
app.use("/api/product", productRouter);
app.use("/api/order", orderRouter);
app.use("/api/customize", customizeRouter);

// Run Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log("Server is running on ", PORT);
});
