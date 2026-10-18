
const express = require("express");
const mongoose = require("mongoose");
const StudyGroup = require("../models/StudyGroup");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET all study groups (public)
router.get("/", async (req, res) => {
  try {
    const filter = {};
    const search = req.query.search;
    const subject = req.query.subject;

    if (search) {
      const safeSearch = escapeRegex(String(search));

      filter.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { subject: { $regex: safeSearch, $options: "i" } },
        { description: { $regex: safeSearch, $options: "i" } }
      ];
    }

    if (subject) {
      filter.subject = {
        $regex: escapeRegex(String(subject)),
        $options: "i"
      };
    }

    const groups = await StudyGroup.find(filter).sort({
      createdAt: -1
    });

    return res.json({ success: true, data: groups });
  } catch (error) {
    console.error("Get groups error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve study groups."
    });
  }
});

// GET one study group by ID (public)
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID."
      });
    }

    const group = await StudyGroup.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Study group not found."
      });
    }

    return res.json({ success: true, data: group });
  } catch (error) {
    console.error("Get group error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve the study group."
    });
  }
});

// CREATE a study group (login required)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      title,
      subject,
      description,
      level,
      schedule,
      maxMembers
    } = req.body;

    if (
      typeof title !== "string" || !title.trim() ||
      typeof subject !== "string" || !subject.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Title and subject are required."
      });
    }

    if (
      maxMembers !== undefined &&
      (!Number.isInteger(maxMembers) ||
        maxMembers < 1 ||
        maxMembers > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Maximum members must be between 1 and 100."
      });
    }

    if (
      description !== undefined &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be text."
      });
    }

    const group = await StudyGroup.create({
      title: title.trim(),
      subject: subject.trim(),
      description:
        typeof description === "string" ? description.trim() : "",
      level: typeof level === "string" ? level : "Beginner",
      schedule:
        typeof schedule === "string" ? schedule : "Flexible",
      maxMembers: maxMembers ?? 10,

      // Identity always comes from the verified login token.
      creatorName: req.user.name,
      creatorId: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: "Study group created successfully.",
      data: group
    });
  } catch (error) {
    console.error("Create group error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create the study group."
    });
  }
});

// SUBMIT a join request (login required)
router.post("/:id/join", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID."
      });
    }

    if (
      message !== undefined &&
      typeof message !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Message must be text."
      });
    }

    const group = await StudyGroup.findById(id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Study group not found."
      });
    }

    // Do not allow the creator to request membership in their own group.
    if (
      group.creatorId &&
      group.creatorId.toString() === req.user._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "You cannot join your own study group."
      });
    }

    // Check identity using the authenticated user's ID.
    const alreadyRequested = group.joinRequests.some(request => {
      if (request.studentId) {
        return (
          request.studentId.toString() === req.user._id.toString() &&
          request.status !== "Rejected"
        );
      }

      // Compatibility check for older requests without studentId.
      return (
        request.studentName.toLowerCase() ===
          req.user.name.toLowerCase() &&
        request.status !== "Rejected"
      );
    });

    if (alreadyRequested) {
      return res.status(409).json({
        success: false,
        message: "You already have an active request for this group."
      });
    }

    group.joinRequests.push({
      studentName: req.user.name,
      studentId: req.user._id,
      message: typeof message === "string" ? message.trim() : ""
    });

    await group.save();

    return res.status(201).json({
      success: true,
      message: "Join request submitted.",
      data: group
    });
  } catch (error) {
    console.error("Join request error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to submit the join request."
    });
  }
});

// APPROVE or REJECT a request (group creator only)
router.patch(
  "/:id/requests/:requestId/status",
  authMiddleware,
  async (req, res) => {
    try {
      const { id, requestId } = req.params;
      const { status } = req.body;

      if (!["Approved", "Rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be Approved or Rejected."
        });
      }

      if (
        !mongoose.isValidObjectId(id) ||
        !mongoose.isValidObjectId(requestId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid group ID or request ID."
        });
      }

      const group = await StudyGroup.findById(id);

      if (!group) {
        return res.status(404).json({
          success: false,
          message: "Study group not found."
        });
      }

      // Legacy groups without ownership cannot be managed through this route.
      if (!group.creatorId) {
        return res.status(403).json({
          success: false,
          message:
            "This older group has no recorded owner. Ownership must be assigned before requests can be managed."
        });
      }

      // Only the account that created the group can manage its requests.
      if (group.creatorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Only the creator of this group can manage requests."
        });
      }

      const request = group.joinRequests.id(requestId);

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Join request not found."
        });
      }

      if (request.status !== "Pending") {
        return res.status(400).json({
          success: false,
          message: "This request has already been processed."
        });
      }

      if (status === "Approved") {
        const approvedCount = group.joinRequests.filter(
          item => item.status === "Approved"
        ).length;

        if (approvedCount >= group.maxMembers) {
          return res.status(400).json({
            success: false,
            message: "This study group is full."
          });
        }
      }

      request.status = status;
      await group.save();

      return res.status(200).json({
        success: true,
        message: `Join request ${status.toLowerCase()} successfully.`,
        data: group
      });
    } catch (error) {
      console.error("Update join request error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to update join request."
      });
    }
  }
);

module.exports = router;
