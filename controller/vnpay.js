const { createPaymentUrl, verifyReturnUrl } = require("../utils/vnpay");
const orderModel = require("../models/orders");
const pendingOrderModel = require("../models/pendingOrders");

class VNPayController {
  async createPaymentUrl(req, res) {
    try {
      const { orderId, amount, orderDescription, ipAddr, orderData } = req.body;

      if (!orderId || !amount) {
        return res.json({ 
          error: "Order ID and amount are required" 
        });
      }

      if (orderData) {
        try {
          const pendingOrder = new pendingOrderModel({
            transactionId: orderId.toString(),
            allProduct: orderData.allProduct,
            user: orderData.user,
            amount: orderData.amount,
            address: orderData.address,
            phone: orderData.phone,
            paymentMethod: orderData.paymentMethod || "VNPAY",
          });
          await pendingOrder.save();
        } catch (error) {
        }
      }

      const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                       req.headers['x-real-ip'] || 
                       req.connection.remoteAddress || 
                       req.socket.remoteAddress ||
                       "127.0.0.1";

      const cleanDescription = (orderDescription || `Thanh toan don hang ${orderId}`)
        .replace(/[#&<>"']/g, "")
        .trim()
        .substring(0, 255);

      let cleanOrderId = orderId.toString().replace(/[^a-zA-Z0-9]/g, "");
      if (!cleanOrderId || cleanOrderId.length === 0) {
        cleanOrderId = Date.now().toString();
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.json({ 
          error: "Invalid amount: " + amount 
        });
      }

      const paymentUrl = createPaymentUrl({
        orderId: cleanOrderId,
        amount: amountNum,
        orderDescription: cleanDescription || `Thanh toan don hang ${cleanOrderId}`,
        ipAddr: clientIp,
      });
      return res.json({ 
        success: true,
        paymentUrl 
      });
    } catch (error) {
      return res.json({ 
        error: "Failed to create payment URL: " + error.message 
      });
    }
  }

  /**
   * Xử lý callback từ VNPay (Return URL)
   */
  async vnpayReturn(req, res) {
    try {
      const vnp_Params = req.query;
      const secureHash = vnp_Params["vnp_SecureHash"];
      const isValid = verifyReturnUrl({ ...vnp_Params });
      const responseCode = vnp_Params["vnp_ResponseCode"];
      
      if (!isValid && responseCode !== "00") {
        return res.redirect(
          `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/vnpay-return?status=failed&message=Invalid checksum&vnp_ResponseCode=${responseCode || ""}`
        );
      }

      const transactionId = vnp_Params["vnp_TxnRef"];
      const transactionNo = vnp_Params["vnp_TransactionNo"];
      const amount = parseInt(vnp_Params["vnp_Amount"]) / 100;
      const bankCode = vnp_Params["vnp_BankCode"];
      const bankTranNo = vnp_Params["vnp_BankTranNo"];
      if (responseCode === "00") {
        try {
          const existingOrder = await orderModel.findOne({ 
            vnp_TransactionNo: transactionNo 
          });

          if (existingOrder) {
            return res.redirect(
              `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/vnpay-return?status=success&orderId=${existingOrder._id}`
            );
          }

          const pendingOrder = await pendingOrderModel.findOne({ transactionId: transactionId });
          
          if (!pendingOrder) {
            return res.redirect(
              `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/vnpay-return?status=failed&message=Order data not found`
            );
          }

          const newOrder = new orderModel({
            allProduct: pendingOrder.allProduct,
            user: pendingOrder.user,
            amount: pendingOrder.amount,
            transactionId: transactionNo,
            address: pendingOrder.address,
            phone: pendingOrder.phone,
            paymentMethod: "VNPAY",
            paymentStatus: "paid",
            vnp_TransactionNo: transactionNo,
            status: "Processing",
          });

          const savedOrder = await newOrder.save();
          await pendingOrderModel.deleteOne({ transactionId: transactionId });

          return res.redirect(
            `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/vnpay-return?status=success&orderId=${savedOrder._id}`
          );
        } catch (error) {
          return res.redirect(
            `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/vnpay-return?status=failed&message=Error creating order`
          );
        }
      } else {
        let errorMessage = "Giao dịch thanh toán không thành công";
        const responseCodeMessages = {
          "07": "Giao dịch bị nghi ngờ (fraud)",
          "09": "Thẻ/Tài khoản chưa đăng ký dịch vụ Internet Banking",
          "10": "Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần",
          "11": "Đã hết hạn chờ thanh toán",
          "12": "Thẻ/Tài khoản bị khóa",
          "24": "Khách hàng hủy giao dịch",
          "51": "Tài khoản không đủ số dư để thực hiện giao dịch",
          "65": "Tài khoản đã vượt quá hạn mức giao dịch",
          "75": "Ngân hàng thanh toán đang bảo trì",
          "99": "Lỗi không xác định"
        };
        
        if (responseCodeMessages[responseCode]) {
          errorMessage = responseCodeMessages[responseCode];
        }
        
        try {
          await pendingOrderModel.deleteOne({ transactionId: transactionId });
        } catch (error) {
        }
        
        const redirectUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/vnpay-return?status=failed&code=${responseCode || "unknown"}&message=${encodeURIComponent(errorMessage)}&vnp_ResponseCode=${responseCode || ""}&vnp_TransactionNo=${transactionNo || ""}&vnp_Amount=${vnp_Params["vnp_Amount"] || ""}`;
        return res.redirect(redirectUrl);
      }
    } catch (error) {
      return res.redirect(
        `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/vnpay-return?status=failed&message=Server error`
      );
    }
  }

  async confirmPaymentFromFrontend(req, res) {
    try {
      const { transactionId, vnpTransactionNo, vnpResponseCode } = req.body;

      if (!transactionId || !vnpTransactionNo || vnpResponseCode !== "00") {
        return res.json({ 
          error: "Invalid parameters or payment not successful" 
        });
      }

      const existingOrder = await orderModel.findOne({ 
        vnp_TransactionNo: vnpTransactionNo 
      });

      if (existingOrder) {
        return res.json({ 
          success: true,
          orderId: existingOrder._id.toString(),
          message: "Order already exists"
        });
      }

      const pendingOrder = await pendingOrderModel.findOne({ transactionId: transactionId });
      
      if (!pendingOrder) {
        return res.json({ 
          error: "Pending order not found. Payment may have expired." 
        });
      }

      const newOrder = new orderModel({
        allProduct: pendingOrder.allProduct,
        user: pendingOrder.user,
        amount: pendingOrder.amount,
        transactionId: vnpTransactionNo,
        address: pendingOrder.address,
        phone: pendingOrder.phone,
        paymentMethod: "VNPAY",
        paymentStatus: "paid",
        vnp_TransactionNo: vnpTransactionNo,
        status: "Processing",
      });

      const savedOrder = await newOrder.save();
      await pendingOrderModel.deleteOne({ transactionId: transactionId });

      return res.json({ 
        success: true,
        orderId: savedOrder._id.toString(),
        message: "Order created successfully"
      });
    } catch (error) {
      console.error("Error confirming payment from frontend:", error);
      return res.json({ 
        error: "Failed to create order: " + error.message 
      });
    }
  }

  /**
   * Xử lý IPN (Instant Payment Notification) từ VNPay
   * VNPay server gọi endpoint này để cập nhật trạng thái thanh toán
   */
  async vnpayIpn(req, res) {
    try {
      let vnp_Params = {};
      
      if (req.method === "POST") {
        if (req.body && Object.keys(req.body).length > 0) {
          vnp_Params = req.body;
        } else if (req.query && Object.keys(req.query).length > 0) {
          vnp_Params = req.query;
        }
      } else {
        vnp_Params = req.query;
      }
      
      if (!vnp_Params || Object.keys(vnp_Params).length === 0) {
        return res.status(200).json({ RspCode: "99", Message: "No parameters" });
      }
      
      const isValid = verifyReturnUrl({ ...vnp_Params });

      if (!isValid) {
        return res.status(200).json({ RspCode: "97", Message: "Checksum failed" });
      }

      const transactionId = vnp_Params["vnp_TxnRef"];
      const responseCode = vnp_Params["vnp_ResponseCode"];
      const transactionNo = vnp_Params["vnp_TransactionNo"];

      const existingOrder = await orderModel.findOne({ 
        vnp_TransactionNo: transactionNo 
      });

      if (existingOrder) {
        return res.status(200).json({ RspCode: "00", Message: "Order already confirmed" });
      }

      if (responseCode === "00") {
        try {
          const pendingOrder = await pendingOrderModel.findOne({ transactionId: transactionId });
          
          if (!pendingOrder) {
            return res.status(200).json({ RspCode: "02", Message: "Order not found" });
          }

          const newOrder = new orderModel({
            allProduct: pendingOrder.allProduct,
            user: pendingOrder.user,
            amount: pendingOrder.amount,
            transactionId: transactionNo,
            address: pendingOrder.address,
            phone: pendingOrder.phone,
            paymentMethod: "VNPAY",
            paymentStatus: "paid",
            vnp_TransactionNo: transactionNo,
            status: "Processing",
          });

          await newOrder.save();
          await pendingOrderModel.deleteOne({ transactionId: transactionId });

          return res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
        } catch (error) {
          return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
        }
      } else {
        try {
          await pendingOrderModel.deleteOne({ transactionId: transactionId });
        } catch (error) {
        }
        
        return res.status(200).json({ RspCode: "00", Message: "Payment Failed" });
      }
    } catch (error) {
      return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
    }
  }
}

const vnpayController = new VNPayController();
module.exports = vnpayController;

