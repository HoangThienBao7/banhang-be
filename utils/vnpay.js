const crypto = require("crypto");
const querystring = require("querystring");

const VNPAY_CONFIG = {
  vnp_TmnCode: "44HSQHSP",
  vnp_HashSecret: "F0EDRCHEZW6MJ3H9QJO36K8LMI0V1SU1",
  vnp_Url: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  vnp_Api: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
  vnp_Environment: "sandbox",
};

function getReturnUrl() {
  return process.env.VNPAY_RETURN_URL || 
         process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/payment/vnpay-return` :
         "http://localhost:3000/payment/vnpay-return";
}

function getIpnUrl() {
  return process.env.VNPAY_IPN_URL || 
         process.env.API_URL ? `${process.env.API_URL}/api/order/vnpay/ipn` :
        //  "http://localhost:8888/api/order/vnpay/ipn";
        "https://banhang-be.vercel.app/api/order/vnpay/ipn";
}


function createPaymentUrl(orderData) {
  const {
    orderId,
    amount,
    orderDescription = "Thanh toan don hang",
    orderType = "other",
    locale = "vn",
    ipAddr = "127.0.0.1",
  } = orderData;

  const date = new Date();
  const createDate = formatDate(date);
  const expireDate = formatDate(new Date(date.getTime() + 15 * 60 * 1000));

  let vnp_Params = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = VNPAY_CONFIG.vnp_TmnCode;
  vnp_Params["vnp_Locale"] = locale;
  vnp_Params["vnp_CurrCode"] = "VND";
  
  let txnRef = orderId.toString().replace(/[^a-zA-Z0-9]/g, "");
  if (!txnRef || txnRef.length === 0) {
    txnRef = Date.now().toString();
  }
  vnp_Params["vnp_TxnRef"] = txnRef.substring(0, 100);
  
  let cleanOrderInfo = (orderDescription || "Thanh toan don hang")
    .replace(/[#&<>"']/g, "")
    .trim();
  
  if (!cleanOrderInfo || cleanOrderInfo.length === 0) {
    cleanOrderInfo = "Thanh toan don hang";
  }
  vnp_Params["vnp_OrderInfo"] = cleanOrderInfo.substring(0, 255);
  vnp_Params["vnp_OrderType"] = orderType;
  
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    throw new Error("Invalid amount: " + amount);
  }
  vnp_Params["vnp_Amount"] = Math.round(amountNum * 100); 
  
  const returnUrl = getReturnUrl();
  vnp_Params["vnp_ReturnUrl"] = returnUrl;
  
  let cleanIp = "127.0.0.1";
  if (ipAddr) {
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ipAddr)) {
      cleanIp = ipAddr;
    } else {
      const ipv4Match = ipAddr.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
      cleanIp = ipv4Match ? ipv4Match[0] : "127.0.0.1";
    }
  }
  vnp_Params["vnp_IpAddr"] = cleanIp;
  vnp_Params["vnp_CreateDate"] = createDate;
  vnp_Params["vnp_ExpireDate"] = expireDate;

  const cleanParams = {};
  for (let key in vnp_Params) {
    const value = vnp_Params[key];
    if (value !== null && value !== undefined) {
      if (typeof value === 'object') {
        continue;
      }
      cleanParams[key] = String(value);
    }
  }

  const sortedParams = sortObject(cleanParams);
  const signParts = [];
  const sortedKeys = Object.keys(sortedParams).sort();
  for (let key of sortedKeys) {
    const value = sortedParams[key];
    if (value !== null && value !== undefined && typeof value !== 'object' && typeof value !== 'function') {
      const encodedValue = encodeURIComponent(String(value)).replace(/%20/g, "+");
      signParts.push(key + "=" + encodedValue);
    }
  }
  const signData = signParts.join("&");
  
  const hmac = crypto.createHmac("sha512", VNPAY_CONFIG.vnp_HashSecret);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  sortedParams["vnp_SecureHash"] = String(signed);
  const finalParams = sortObject(sortedParams);

  const queryParts = [];
  const finalKeys = Object.keys(finalParams).sort();
  for (let key of finalKeys) {
    const value = finalParams[key];
    if (value !== null && value !== undefined && typeof value !== 'object') {
      queryParts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
    }
  }
  const queryString = queryParts.join("&");
  const paymentUrl = VNPAY_CONFIG.vnp_Url + "?" + queryString;

  return paymentUrl;
}


function verifyReturnUrl(vnp_Params) {
  const params = { ...vnp_Params };
  const secureHash = params["vnp_SecureHash"];
  
  if (!secureHash) {
    return false;
  }
  
  delete params["vnp_SecureHash"];
  delete params["vnp_SecureHashType"];

  const cleanParams = {};
  for (let key in params) {
    const value = params[key];
    if (value !== null && value !== undefined && typeof value !== 'object') {
      cleanParams[key] = String(value);
    }
  }

  const sortedParams = sortObject(cleanParams);
  const signParts = [];
  const sortedKeys = Object.keys(sortedParams).sort();
  for (let key of sortedKeys) {
    const value = sortedParams[key];
    if (value !== null && value !== undefined && typeof value !== 'object' && typeof value !== 'function') {
      const encodedValue = encodeURIComponent(String(value)).replace(/%20/g, "+");
      signParts.push(key + "=" + encodedValue);
    }
  }
  let signData = signParts.join("&");
  
  let hmac = crypto.createHmac("sha512", VNPAY_CONFIG.vnp_HashSecret);
  let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  
  if (secureHash !== signed) {
    const signPartsRaw = [];
    for (let key of sortedKeys) {
      const value = sortedParams[key];
      if (value !== null && value !== undefined && typeof value !== 'object' && typeof value !== 'function') {
        signPartsRaw.push(key + "=" + String(value));
      }
    }
    signData = signPartsRaw.join("&");
    hmac = crypto.createHmac("sha512", VNPAY_CONFIG.vnp_HashSecret);
    signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  }

  return secureHash === signed;
}


function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (let key of keys) {
    const value = obj[key];
    if (value !== null && value !== undefined) {
      sorted[key] = String(value);
    }
  }
  return sorted;
}


function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

module.exports = {
  createPaymentUrl,
  verifyReturnUrl,
  VNPAY_CONFIG,
  getReturnUrl,
  getIpnUrl,
};

