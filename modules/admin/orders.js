const express = require("express");
const ObjectId = require("mongodb").ObjectId;
const auth = require("./auth");

module.exports = {
  init: function (router) {
    const orderRouter = express.Router();

    orderRouter.post("/search", auth, async function (req, res) {
      const search = req.fields.search || "";

      const orders = await global.db
        .collection("orders")
        .find({
          $or: [
            {
              name: {
                $regex: ".*" + search + ".*",
                $options: "i",
              },
            },
            {
              email: {
                $regex: ".*" + search + ".*",
                $options: "i",
              },
            },
            {
              mobile: {
                $regex: ".*" + search + ".*",
                $options: "i",
              },
            },
            {
              country: {
                $regex: ".*" + search + ".*",
                $options: "i",
              },
            },
            {
              address: {
                $regex: ".*" + search + ".*",
                $options: "i",
              },
            },
            {
              paidVia: {
                $regex: ".*" + search + ".*",
                $options: "i",
              },
            },
            {
              status: {
                $regex: ".*" + search + ".*",
                $options: "i",
              },
            },
          ],
        })
        .sort({
          createdAt: -1,
        })
        .toArray();

      res.send({
        status: "success",
        message: "Data has been fetched.",
        orders: orders,
      });
    });

    orderRouter.post("/markAsCompleted", auth, async function (req, res) {
      const _id = req.fields._id;

      const order = await global.db.collection("orders").findOne({
        _id: ObjectId(_id),
      });

      if (order == null) {
        res.json({
          status: "error",
          message: "Order not found.",
        });
        return;
      }

      await global.db.collection("orders").findOneAndUpdate(
        {
          _id: order._id,
        },
        {
          $set: {
            status: "Completed",
          },
        }
      );

      res.json({
        status: "success",
        message: "Order has been marked as completed.",
      });
    });

    orderRouter.post("/fetchSingle", auth, async function (req, res) {
      const orderId = req.fields.orderId;

      const order = await global.db.collection("orders").findOne({
        _id: ObjectId(orderId),
      });

      if (order == null) {
        res.json({
          status: "error",
          message: "Order not found.",
        });
        return;
      }

      res.json({
        status: "success",
        message: "Data has been fetched.",
        order: order,
      });
    });

    orderRouter.post("/fetch", auth, async function (req, res) {
      const page = parseInt(req.fields.page) || 1;

      // number of records you want to show per page
      const perPage = 10;

      // get records to skip
      const startFrom = (page - 1) * perPage;

      const orders = await global.db
        .collection("orders")
        .find({})
        .sort({
          createdAt: -1,
        })
        .skip(startFrom)
        .limit(perPage)
        .toArray();

      await global.db.collection("notifications").updateMany(
        {
          type: "order",
        },
        {
          $set: {
            isRead: true,
          },
        }
      );

      res.json({
        status: "success",
        message: "Data has been fetched.",
        orders: orders,
      });
    });

    router.use("/orders", orderRouter);
  },
};
