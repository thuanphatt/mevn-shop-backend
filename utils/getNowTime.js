module.exports = function getCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-11 => 1-12
  const day = now.getDate();
  const hours = now.getHours() < 10 ? "0" + now.getHours() : now.getHours();
  const minutes =
    now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes();
  const seconds =
    now.getSeconds() < 10 ? "0" + now.getSeconds() : now.getSeconds();
  return `${hours}:${minutes}:${seconds} ${day}-${month}-${year}`;
};
