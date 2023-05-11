const jwt = require("jsonwebtoken");
const ObjectId = require("mongodb").ObjectId;

module.exports = async function (req, res, next) {
  try {
    const accessToken = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(accessToken, jwtSecret);
    const adminId = decoded.adminId;

    const admin = await db.collection("admins").findOne({
      accessToken: accessToken,
    });

    if (admin == null) {
      res.json({
        status: "error",
        message: "Admin has been logged out.",
      });
      return;
    }

    delete admin.password;
    delete admin.accessToken;
    delete admin.createdAt;

    req.admin = admin;
    next();
  } catch (exp) {
    res.json({
      status: "error",
      message: "Admin has been logged out.",
    });
  }
};
