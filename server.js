const express = require("express");
require("dotenv").config();
// const cors = require("cors");
const getNowTime = require("./utils/getNowTime");
const app = express();
// app.use(cors());
const http = require("http").createServer(app);

const mongodb = require("mongodb");
const mongoClient = mongodb.MongoClient;
const ObjectId = mongodb.ObjectId;

const formidable = require("express-formidable");
app.use(
  formidable({
    multiples: true, // req.files to be arrays of files
  })
);

const fs = require("fs");
app.use("/uploads", express.static(__dirname + "/uploads"));

// custom modules
const admin = require("./modules/admin/index");
const products = require("./modules/products");
const auth = require("./modules/admin/auth");
const userAuth = require("./modules/auth");
require("./modules/globals");

const bcryptjs = require("bcryptjs");

const jwt = require("jsonwebtoken");
const orders = require("./modules/admin/orders");

global.jwtSecret = process.env.JWT_SECRET;

const socketIO = require("socket.io")(http, {
  cors: {
    origin: "*",
  },
});
global.socketIO = socketIO;

// Add headers before the routes are defined
app.use(function (req, res, next) {
  // res.setHeader("Access-Control-Allow-Credentials", "true");
  // // Website you wish to allow to connect
  // res.setHeader("Access-Control-Allow-Origin", "*");

  // // req methods you wish to allow
  // res.setHeader(
  //   "Access-Control-Allow-Methods",
  //   "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  // );

  // // req headers you wish to allow
  // res.setHeader(
  //   "Access-Control-Allow-Headers",
  //   "X-reqed-With,content-type,Authorization"
  // );

  // // Set to true if you need the website to include cookies in the reqs sent
  // // to the API (e.g. in case you use sessions)
  // res.setHeader("Access-Control-Allow-Credentials", true);

  // Pass to next layer of middleware
  next();
});
global.adminEmail = process.env.ADMIN_EMAIL;

const port = process.env.PORT || 3000;
http.listen(port, function () {
  console.log("Server started running at port: " + port);

  mongoClient.connect(
    "mongodb://localhost:27017",
    async function (error, client) {
      if (error) {
        console.error(error);
        return;
      }
      const db = client.db("watch-store");
      global.db = db;
      console.log("Database connected");

      admin.init(app);
      products.init(app);

      const adminObj = await db.collection("admins").findOne({});
      if (adminObj == null) {
        bcryptjs.genSalt(10, function (error, salt) {
          bcryptjs.hash("admin", salt, async function (error, hash) {
            await db.collection("admins").insertOne({
              email: global.adminEmail,
              password: hash,
            });
          });
        });
      }

      // route for logout req
      app.post("/logout", userAuth, async function (req, res) {
        const user = req.user;

        // update JWT of user in database
        await db.collection("users").findOneAndUpdate(
          {
            _id: user._id,
          },
          {
            $set: {
              accessToken: "",
            },
          }
        );

        res.json({
          status: "success",
          message: "Logout successfully.",
        });
      });
      app.get("/getUser", async (req, res) => {
        db.collection("users")
          .find({})
          .toArray((err, users) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ message: "Internal server error" });
            }
            res.status(200).json(users);
          });
      });
      app.get("/getUser/:id", async (req, res) => {
        const userId = req.params.id;
        db.collection("users").findOne(
          { _id: ObjectId(userId) },
          (err, user) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ message: "Internal server error" });
            }
            res.status(200).json(user);
          }
        );
      });

      app.put("/edit-profile/users/:id", async (req, res) => {
        const userId = req.params.id;

        const updates = {
          name: req.fields.name,
          email: req.fields.email,
        };

        // Check if updates object is empty
        if (!updates) {
          return res.status(400).json({ message: "No updates provided" });
        }

        // Hash new password if it exists

        // Update user in database without changing password
        await db
          .collection("users")
          .updateOne(
            { _id: ObjectId(userId) },
            { $set: { name: updates.name, email: updates.email } },
            (err, result) => {
              if (err) {
                console.error(err);
                return res
                  .status(500)
                  .json({ message: "Internal server error" });
              }

              // Check if user was updated
              if (result.modifiedCount === 0) {
                return res.status(404).json({ message: "User not found" });
              }

              // Return updated user
              db.collection("users").findOne(
                { _id: ObjectId(userId) },
                (err, user) => {
                  if (err) {
                    console.error(err);
                    return res
                      .status(500)
                      .json({ message: "Internal server error" });
                  }
                  res.status(200).json(user);
                }
              );
            }
          );
      });

      app.put("/changePassword/users/:id", async (req, res) => {
        const userId = req.params.id;
        userId.trim();
        const updates = {
          password: req.fields.password, // add password field
        };

        // Check if updates object is empty
        if (!updates) {
          return res.status(400).json({ message: "No updates provided" });
        }

        // Check if current password is correct
        const userObjId = ObjectId(userId);
        const user = await db.collection("users").findOne({ _id: userObjId });
        const isMatch = await bcryptjs.compare(
          req.fields.currentPassword,
          user.password
        );
        if (!isMatch) {
          return res
            .status(401)
            .json({ message: "Current password is incorrect" });
        }

        // Hash new password
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(req.fields.password, salt);

        // Update user in database with new password
        await db.collection("users").updateOne(
          { _id: ObjectId(userId) },
          {
            $set: {
              password: hashedPassword,
            },
          },
          (err, result) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ message: "Internal server error" });
            }

            // Check if user was updated
            if (result.modifiedCount === 0) {
              return res.status(404).json({ message: "User not found" });
            }

            // Return updated user
            db.collection("users").findOne(
              { _id: ObjectId(userId) },
              (err, user) => {
                if (err) {
                  console.error(err);
                  return res
                    .status(500)
                    .json({ message: "Internal server error" });
                }
                res.status(200).json(user);
              }
            );
          }
        );
      });

      app.post("/getUser", userAuth, async function (req, res) {
        const user = req.user;

        res.json({
          status: "success",
          message: "Data has been fetched.",
          user: user,
        });
      });

      // route for login reqs
      app.post("/login", async function (req, res) {
        // get values from login form
        const email = req.fields.email;
        const password = req.fields.password;

        // check if email exists
        const user = await db.collection("users").findOne({
          email: email,
        });

        if (user == null) {
          res.json({
            status: "error",
            message: "Email does not exists.",
          });
          return;
        }

        // check if password is correct
        bcryptjs.compare(
          password,
          user.password,
          async function (error, isVerify) {
            if (isVerify) {
              // generate JWT of user
              const accessToken = jwt.sign(
                {
                  userId: user._id.toString(),
                },
                jwtSecret
              );

              // update JWT of user in database
              await db.collection("users").findOneAndUpdate(
                {
                  email: email,
                },
                {
                  $set: {
                    accessToken: accessToken,
                  },
                }
              );

              res.json({
                status: "success",
                message: "Login successfully.",
                accessToken: accessToken,
                user: {
                  name: user.name,
                  email: user.email,
                },
              });

              return;
            }

            res.json({
              status: "error",
              message: "Password is not correct.",
            });
          }
        );
      });

      app.post("/registration", async function (req, res) {
        const name = req.fields.name;
        const email = req.fields.email;
        const password = req.fields.password;

        if (!name || !email || !password) {
          res.json({
            status: "error",
            message: "Please enter all values.",
          });
          return;
        }

        if (email == global.adminEmail) {
          res.json({
            status: "error",
            message:
              "Sorry, you cannot create an account with this email address.",
          });
          return;
        }

        // check if email already exists
        var user = await db.collection("users").findOne({
          email: email,
        });

        if (user != null) {
          res.json({
            status: "error",
            message: "Email already exists.",
          });
          return;
        }

        bcryptjs.genSalt(10, function (error, salt) {
          bcryptjs.hash(password, salt, async function (error, hash) {
            // insert in database
            await db.collection("users").insertOne({
              name: name,
              email: email,
              password: hash,
              accessToken: "",
              createdAt: createdAt,
              lastMessageAt: 0,
            });

            res.json({
              status: "success",
              message: "Account has been created. Please login now.",
            });
          });
        });
      });

      app.post("/cashOnDelivery", async function (req, res) {
        const productsCart = JSON.parse(req.fields.products);
        const name = req.fields.name;
        const email = req.fields.email;
        const mobile = req.fields.mobile;
        const country = req.fields.country;
        const address = req.fields.address;

        for (let a = 0; a < productsCart.length; a++) {
          productsCart[a]._id = ObjectId(productsCart[a]._id);
        }

        const response = await global.decrementItemsInStock(productsCart);
        if (response.status == "error") {
          res.json({
            status: "error",
            message: response.message,
          });
          return;
        }

        await db.collection("orders").insertOne({
          cart: productsCart,
          name: name,
          email: email,
          mobile: mobile,
          country: country,
          address: address,
          paidVia: "COD",
          status: "Processing",
          createdAt: getNowTime(),
        });

        const configurations = await global.db
          .collection("configurations")
          .findOne({});

        let listItems = "";
        productsCart.forEach((order) => {
          listItems += `
          <div>
          You have successfully placed your order
          <br/>
          <br/>
          <b>Name</b>: ${order.name} x ${order.units}
          <br/>
          <br/>
          <b>Price</b>: $${order.price} 
          <br/>
          <br/>
          Expected 3-4 days the order will be delivered to you
          </div>
          `;
        });
        if (configurations != null) {
          console.log("email: " + email);
          global.sendMail(
            email,
            "You have a new order from the store",
            listItems
          );
        }

        await db.collection("notifications").insertOne({
          type: "order",
          isRead: false,
        });

        socketIO.emit("newOrder", 1);

        res.json({
          status: "success",
          message:
            "Your order has been received. We will let you know via E-mail about your order tracking.",
        });
      });

      app.post("/paidViaPaypal", async function (req, res) {
        const productsCart = JSON.parse(req.fields.products);
        const details = JSON.parse(req.fields.details);
        const name = req.fields.name;
        const email = req.fields.email;
        const mobile = req.fields.mobile;
        const country = req.fields.country;
        const address = req.fields.address;

        for (let a = 0; a < productsCart.length; a++) {
          productsCart[a]._id = ObjectId(productsCart[a]._id);
        }

        if (details.status == "COMPLETED") {
          const response = await global.decrementItemsInStock(productsCart);
          if (response.status == "error") {
            res.json({
              status: "error",
              message: response.message,
            });
            return;
          }

          await db.collection("orders").insertOne({
            cart: productsCart,
            name: name,
            email: email,
            mobile: mobile,
            country: country,
            address: address,
            details: details,
            paidVia: "PayPal",
            status: "Processing",
            createdAt: getNowTime(),
          });

          let listItems = "";
          productsCart.forEach((order) => {
            listItems += `
          <div>
          You have successfully placed your order
          <br/>
          <br/>
          <b>Name</b>: ${order.name} x ${order.units}
          <br/>
          <br/>
          <b>Price</b>: $${order.price} 
          <br/>
          <br/>
          Expected 3-4 days the order will be delivered to you
          </div>
          `;
          });
          const configurations = await global.db
            .collection("configurations")
            .findOne({});
          if (configurations != null) {
            global.sendMail(
              email,
              "You have a new order from the store",
              listItems
            );
          }

          await db.collection("notifications").insertOne({
            type: "order",
            isRead: false,
          });

          socketIO.emit("newOrder", 1);

          res.json({
            status: "success",
            message:
              "Your order has been received. We will let you know via E-mail about your order tracking.",
          });
        } else {
          res.json({
            status: "error",
            message: "Error processing your payment.",
          });
        }
      });

      app.post("/confirmStripePayment", async function (req, res) {
        const paymentId = req.fields.paymentId;
        const productsCart = JSON.parse(req.fields.products);
        const name = req.fields.name;
        const email = req.fields.email;
        const mobile = req.fields.mobile;
        const country = req.fields.country;
        const address = req.fields.address;

        for (let a = 0; a < productsCart.length; a++) {
          productsCart[a]._id = ObjectId(productsCart[a]._id);
        }

        const stripe = await global.getStripeObj(res);
        if (stripe == null) {
          return;
        }
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);

        if (paymentIntent.status == "succeeded") {
          const response = await global.decrementItemsInStock(productsCart);
          if (response.status == "error") {
            res.json({
              status: "error",
              message: response.message,
            });
            return;
          }

          await db.collection("orders").insertOne({
            cart: productsCart,
            name: name,
            email: email,
            mobile: mobile,
            country: country,
            address: address,
            stripePaymentId: paymentId,
            paidVia: "Stripe",
            status: "Processing",
            createdAt: getNowTime(),
          });

          let listItems = "";
          productsCart.forEach((order) => {
            listItems += `
            <div>
            You have successfully placed your order
            <br/>
            <br/>
            <b>Name</b>: ${order.name} x ${order.units}
            <br/>
            <br/>
            <b>Price</b>: $${order.price} 
            <br/>
            <br/>
            Expected 3-4 days the order will be delivered to you
            </div>
            `;
          });
          const configurations = await global.db
            .collection("configurations")
            .findOne({});
          if (configurations != null) {
            global.sendMail(
              email,
              "You have a new order from the store",
              listItems
            );
          }

          await db.collection("notifications").insertOne({
            type: "order",
            isRead: false,
          });

          socketIO.emit("newOrder", 1);

          res.json({
            status: "success",
            message:
              "Your order has been received. We will let you know via E-mail about your order tracking.",
          });
        } else {
          res.json({
            status: "error",
            message: "Error processing your payment: " + paymentIntent.status,
          });
        }
      });

      app.post("/getStripeClientSecret", async function (req, res) {
        const total = req.fields.total * 100;

        const stripe = await global.getStripeObj(res);
        if (stripe == null) {
          return;
        }
        const paymentIntent = await stripe.paymentIntents.create({
          amount: total,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.json({
          status: "success",
          message: "Data has been fetched.",
          clientSecret: paymentIntent.client_secret,
        });
      });

      app.post("/getConfigurations", async function (req, res) {
        const configurations = await db
          .collection("configurations")
          .findOne({});
        if (configurations == null) {
          res.json({
            status: "error",
            message: "Please set your configurations from admin dashboard.",
          });
          return;
        }

        res.json({
          status: "success",
          message: "Data has been fetched.",
          configurations: configurations,
        });
      });
    }
  );
});
