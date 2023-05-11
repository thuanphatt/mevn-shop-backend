const express = require("express");
const fileSystem = require("fs");
const auth = require("./auth");
const ObjectId = require("mongodb").ObjectId;

module.exports = {
  callbackFileUpload: function (
    images,
    index,
    savedPaths = [],
    success = null,
    error = null
  ) {
    const self = this;

    if (images.length > index) {
      fileSystem.readFile(images[index].path, function (error, data) {
        if (error) {
          console.error(error);
          return;
        }

        let filePath =
          "uploads/" + new Date().getTime() + "-" + images[index].name;

        fileSystem.writeFile(filePath, data, async function (error) {
          if (error) {
            console.error(error);
            return;
          }

          console.log("image " + (index + 1) + " uploaded");
          savedPaths.push(filePath);

          if (index == images.length - 1) {
            console.log("last image uploaded");

            if (success != null) {
              success(savedPaths);
            }
          } else {
            index++;
            self.callbackFileUpload(images, index, savedPaths, success, error);
          }
        });

        fileSystem.unlink(images[index].path, function (error) {
          if (error) {
            console.error(error);
            return;
          }
        });
      });
    } else {
      if (success != null) {
        success(savedPaths);
      }
    }
  },

  init: function (router) {
    const self = this;
    const productsRouter = express.Router();

    productsRouter.post("/destroy", auth, async function (req, res) {
      const _id = req.fields._id;

      const product = await global.db.collection("products").findOne({
        _id: ObjectId(_id),
      });

      if (product == null) {
        res.json({
          status: "error",
          message: "Product not found.",
        });
        return;
      }

      for (let a = 0; a < product.images.length; a++) {
        fileSystem.unlink(product.images[a], function (error) {
          console.log(error);
        });
      }

      await global.db.collection("products").remove({
        _id: product._id,
      });

      res.json({
        status: "success",
        message: "Product has been deleted.",
      });
    });

    productsRouter.post("/update", auth, async function (req, res) {
      const name = req.fields.name;
      const description = req.fields.description;
      const price = req.fields.price;
      const itemsInStock = parseInt(req.fields.itemsInStock) || 0;
      const category = req.fields.category || "";
      const tempSpecs = JSON.parse(req.fields.specs) || [];
      const _id = req.fields._id;

      const product = await global.db.collection("products").findOne({
        _id: ObjectId(_id),
      });

      if (product == null) {
        res.json({
          status: "error",
          message: "Product not found.",
        });
        return;
      }

      // check if all files are image
      for (let a = 0; a < req.files.images.length; a++) {
        if (
          req.files.images[a].size > 0 &&
          (req.files.images[a].type == "image/jpeg" ||
            req.files.images[a].type == "image/png")
        ) {
          //
        } else {
          res.json({
            status: "error",
            message: "Please select image file only.",
          });
          return;
        }
      }

      const images = [];
      if (Array.isArray(req.files.images)) {
        for (let a = 0; a < req.files.images.length; a++) {
          images.push(req.files.images[a]);
        }
      } else {
        if (req.files.images.size > 0) {
          images.push(req.files.images);
        }
      }

      self.callbackFileUpload(images, 0, [], async function (savedPaths) {
        // add in mongo db

        const configurations = await global.db
          .collection("configurations")
          .findOne({});
        if (configurations != null) {
          let categories = configurations.categories || [];
          let flag = false;
          for (let a = 0; a < categories.length; a++) {
            if (categories[a] == category) {
              flag = true;
              break;
            }
          }
          if (category != "" && !flag) {
            await global.db.collection("configurations").findOneAndUpdate(
              {},
              {
                $push: {
                  categories: category,
                },
              }
            );
          }
        }

        if (savedPaths.length > 0) {
          // delete previous images
          for (let a = 0; a < product.images.length; a++) {
            fileSystem.unlink(product.images[a], function (error) {
              console.log(error);
            });
          }

          const specs = [];
          for (let a = 0; a < tempSpecs.length; a++) {
            specs.push({
              key: tempSpecs[a].key,
              value: tempSpecs[a].value,
            });
          }

          await global.db.collection("products").findOneAndUpdate(
            {
              _id: product._id,
            },
            {
              $set: {
                name: name,
                description: description,
                price: parseFloat(price),
                itemsInStock: itemsInStock,
                category: category,
                specs: specs,
                images: savedPaths,
              },
            }
          );
        } else {
          await global.db.collection("products").findOneAndUpdate(
            {
              _id: product._id,
            },
            {
              $set: {
                name: name,
                description: description,
                itemsInStock: itemsInStock,
                category: category,
                // specs: specs,
                price: parseFloat(price),
              },
            }
          );
        }

        res.json({
          status: "success",
          message: "Product has been updated.",
        });
      });
    });

    productsRouter.post("/fetchSingle", auth, async function (req, res) {
      const _id = req.fields._id;

      const product = await global.db.collection("products").findOne({
        _id: ObjectId(_id),
      });

      if (product == null) {
        res.json({
          status: "error",
          message: "Product not found.",
        });
        return;
      }

      res.json({
        status: "success",
        message: "Data has been fetched.",
        product: product,
      });
    });

    productsRouter.post("/fetch", auth, async function (req, res) {
      const page = parseInt(req.fields.page) || 1;

      // number of records you want to show per page
      const perPage = 10;

      // get records to skip
      const startFrom = (page - 1) * perPage;

      const products = await global.db
        .collection("products")
        .find({})
        .sort({
          createdAt: -1,
        })
        .skip(startFrom)
        .limit(perPage)
        .toArray();

      res.json({
        status: "success",
        message: "Data has been fetched.",
        products: products,
      });
    });

    productsRouter.post("/add", auth, function (req, res) {
      const name = req.fields.name;
      const description = req.fields.description;
      const price = req.fields.price;
      const itemsInStock = parseInt(req.fields.itemsInStock) || 0;
      const category = req.fields.category || "";
      const tempSpecs = JSON.parse(req.fields.specs) || [];

      if (itemsInStock < 0) {
        res.json({
          status: "error",
          message: "Items in stock must be a positive number.",
        });
        return;
      }

      // check if all files are image
      for (let a = 0; a < req.files.images.length; a++) {
        if (
          req.files.images[a].size > 0 &&
          (req.files.images[a].type == "image/jpeg" ||
            req.files.images[a].type == "image/png")
        ) {
          //
        } else {
          res.json({
            status: "error",
            message: "Please select image file only.",
          });
          return;
        }
      }

      const images = [];
      if (Array.isArray(req.files.images)) {
        for (let a = 0; a < req.files.images.length; a++) {
          images.push(req.files.images[a]);
        }
      } else {
        images.push(req.files.images);
      }

      self.callbackFileUpload(images, 0, [], async function (savedPaths) {
        // add in mongo db

        const configurations = await global.db
          .collection("configurations")
          .findOne({});
        if (configurations != null) {
          let categories = configurations.categories || [];
          let flag = false;
          for (let a = 0; a < categories.length; a++) {
            if (categories[a] == category) {
              flag = true;
              break;
            }
          }
          if (category != "" && !flag) {
            await global.db.collection("configurations").findOneAndUpdate(
              {},
              {
                $push: {
                  categories: category,
                },
              }
            );
          }
        }

        const specs = [];
        for (let a = 0; a < tempSpecs.length; a++) {
          specs.push({
            key: tempSpecs[a].key,
            value: tempSpecs[a].value,
          });
        }

        await global.db.collection("products").insertOne({
          name: name,
          description: description,
          price: parseFloat(price),
          itemsInStock: itemsInStock,
          images: savedPaths,
          category: category,
          specs: specs,
          createdAt: new Date().getTime(),
        });

        res.json({
          status: "success",
          message: "Product has been added.",
        });
      });
    });

    router.use("/products", productsRouter);
  },
};
