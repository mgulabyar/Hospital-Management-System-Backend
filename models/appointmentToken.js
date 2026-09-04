const mongoose = require("mongoose");

const appointmentTokenSchema = new mongoose.Schema(
  {
    tokenNumber: {
      type: Number,
      required: true,
    },

    displayToken: {
      type: String,
      required: true,
      trim: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientProfile",
      required: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    departmentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },

    vitals: {
      bp: {
        type: String,
        default: "N/A",
      },

      pulse: {
        type: Number,
        default: 0,
      },

      weight: {
        type: Number,
        default: 0,
      },

      temperature: {
        type: Number,
        default: 0,
      },
    },

    status: {
      type: String,
      enum: ["Pending", "In-Consultation", "Completed", "Cancelled"],
      default: "Pending",
    },

    visitDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

appointmentTokenSchema.index(
  {
    departmentRef: 1,
    visitDate: 1,
    tokenNumber: 1,
  },
  {
    unique: true,
  },
);

appointmentTokenSchema.index(
  {
    appointment: 1,
  },
  {
    unique: true,
    sparse: true,
  },
);

appointmentTokenSchema.index({
  doctor: 1,
  status: 1,
  visitDate: 1,
});

module.exports = mongoose.model("AppointmentToken", appointmentTokenSchema);
