const mongoose = require("mongoose");

const ipdAdmissionSchema = new mongoose.Schema(
  {
    admissionNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientProfile",
      required: true,
    },

    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ward",
      required: true,
    },

    bedId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    bedNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    admittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    attendingDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    admissionReason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    initialNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    admissionDate: {
      type: Date,
      default: Date.now,
    },

    dischargeDate: {
      type: Date,
      default: null,
    },

    dischargeSummary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    status: {
      type: String,
      enum: ["Admitted", "Discharged", "Transferred", "Cancelled"],
      default: "Admitted",
    },
  },
  { timestamps: true },
);

ipdAdmissionSchema.index(
  {
    patient: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "Admitted",
    },
  },
);

ipdAdmissionSchema.index({
  ward: 1,
  status: 1,
});

ipdAdmissionSchema.index({
  attendingDoctor: 1,
  status: 1,
});

module.exports =
  mongoose.models.IPDAdmission ||
  mongoose.model("IPDAdmission", ipdAdmissionSchema);
