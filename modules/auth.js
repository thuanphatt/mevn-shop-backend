const jwt = require("jsonwebtoken");
const jwtSecret = "jwtSecret1234567890";
const ObjectId = require("mongodb").ObjectId;
require("./globals");

module.exports = async function (req, res, next) {
  try {
    const accessToken = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(accessToken, jwtSecret);
    const userId = decoded.userId;

    const user = await global.db.collection("users").findOne({
      accessToken: accessToken,
    });

    if (user == null) {
      res.json({
        status: "error",
        message: "User has been logged out.",
      });
      return;
    }

    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
    };
    next();
  } catch (exp) {
    res.json({
      status: "error",
      message: "User has been logged out.",
    });
  }
};
