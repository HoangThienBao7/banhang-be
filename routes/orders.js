const express = require("express");
const router = express.Router();
const ordersController = require("../controller/orders");
const vnpayController = require("../controller/vnpay");

router.get("/get-all-orders", ordersController.getAllOrders);
router.post("/order-by-user", ordersController.getOrderByUser);

router.post("/create-order", ordersController.postCreateOrder);
router.post("/update-order", ordersController.postUpdateOrder);
router.post("/delete-order", ordersController.postDeleteOrder);

// VNPay routes
router.post("/vnpay/create-payment", vnpayController.createPaymentUrl);
router.get("/vnpay/return", vnpayController.vnpayReturn);
// API để frontend xác nhận thanh toán và tạo order
router.post("/vnpay/confirm-payment", vnpayController.confirmPaymentFromFrontend);
// IPN có thể là GET hoặc POST tùy theo cấu hình VNPay
router.get("/vnpay/ipn", vnpayController.vnpayIpn);
router.post("/vnpay/ipn", vnpayController.vnpayIpn);

module.exports = router;
