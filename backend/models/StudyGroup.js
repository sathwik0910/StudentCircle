
const mongoose = require("mongoose");

const studyGroupSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    level: {
      type: String,
      default: "Beginner"
    },
    schedule: {
      type: String,
      default: "Flexible"
    },
    maxMembers: {
      type: Number,
      default: 10,
      min: 1
    },
    creatorName: {
      type: String,
      required: true,
      trim: true
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    joinRequests: [
      {
        studentName: {
          type: String,
          required: true
        },
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null
        },
        message: {
          type: String,
          default: ""
        },
        status: {
          type: String,
          enum: ["Pending", "Approved", "Rejected"],
          default: "Pending"
        },
        requestedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("StudyGroup", studyGroupSchema);
