const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const pendingOrderSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    allProduct: [
      {
        id: { type: ObjectId, ref: "products" },
        quantitiy: Number,
      },
    ],
    user: {
      type: ObjectId,
      ref: "users",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    phone: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      default: "VNPAY",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 phút
      index: { expireAfterSeconds: 0 }, // Tự động xóa sau khi hết hạn
    },
  },
  { timestamps: true }
);

const pendingOrderModel = mongoose.model("pendingOrders", pendingOrderSchema);
module.exports = pendingOrderModel;

