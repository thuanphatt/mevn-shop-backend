const express = require("express");
const products = require("./products");
const orders = require("./orders");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const auth = require("./auth");

module.exports = {
  init: function (app) {
    const router = express.Router();

    router.post("/getUsers", auth, async function (req, res) {
      const admin = req.admin;

      const users = await global.db
        .collection("users")
        .find({})
        .sort({
          lastMessageAt: -1,
        })
        .toArray();

      for (let a = 0; a < users.length; a++) {
        delete users[a].password;
        delete users[a].accessToken;
      }

      res.json({
        status: "success",
        message: "Data has been fetched.",
        data: users,
      });
    });

    router.post("/saveConfigurations", auth, async function (req, res) {
      const admin = req.admin;
      const stripePublishableKey = req.fields.stripePublishableKey;
      const stripeSecretKey = req.fields.stripeSecretKey;
      const paypalClientId = req.fields.paypalClientId;
      const adminEmail = req.fields.adminEmail;

      await global.db.collection("configurations").findOneAndUpdate(
        {},
        {
          $set: {
            stripePublishableKey: stripePublishableKey,
            stripeSecretKey: stripeSecretKey,
            paypalClientId: paypalClientId,
            adminEmail: adminEmail,
          },
        },
        {
          upsert: true,
        }
      );

      res.json({
        status: "success",
        message: "Configuration has been saved.",
      });
    });

    router.post("/logout", auth, async function (req, res) {
      const admin = req.admin;

      await global.db.collection("admins").findOneAndUpdate(
        {
          _id: admin._id,
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

    router.post("/fetch", auth, async function (req, res) {
      const admin = req.admin;

      const notifications = await global.db
        .collection("notifications")
        .find({
          isRead: false,
        })
        .toArray();

      let unReadOrderNotifications = 0;
      for (let a = 0; a < notifications.length; a++) {
        if (notifications[a].type == "order") {
          unReadOrderNotifications++;
        }
      }

      res.json({
        status: "success",
        message: "Data has been fetched.",
        admin: admin,
        unReadOrderNotifications: unReadOrderNotifications,
      });
    });

    // route for login reqs
    router.post("/login", async function (req, res) {
      // get values from login form
      const email = req.fields.email;
      const password = req.fields.password;

      // check if email exists
      const admin = await global.db.collection("admins").findOne({
        email: email,
      });

      if (admin == null) {
        res.json({
          status: "error",
          message: "Email does not exists.",
        });
        return;
      }

      // check if password is correct
      bcryptjs.compare(
        password,
        admin.password,
        async function (error, isVerify) {
          if (isVerify) {
            // generate JWT of admin
            const accessToken = jwt.sign(
              {
                userId: admin._id.toString(),
              },
              global.jwtSecret
            );

            // update JWT of admin in database
            await global.db.collection("admins").findOneAndUpdate(
              {
                email: email,
              },
              {
                $set: {
                  accessToken: accessToken,
                },
              }
            );

            admin.accessToken = accessToken;

            res.json({
              status: "success",
              message: "Login successfully.",
              accessToken: accessToken,
              admin: admin,
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

    app.use("/admin", router);
    products.init(router);
    orders.init(router);
  },
};
