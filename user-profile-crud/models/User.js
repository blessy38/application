import mongoose from "mongoose";

export const DEFAULT_PROFILE_PHOTO = "/uploads/default-avatar.png";

const TRUVEDA_PATTERN = /^[a-zA-Z0-9_]+$/;
const EMAIL_PATTERN = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
const MAX_FIRST_NAME = 50;
const MAX_LAST_NAME = 50;
const MAX_DISPLAY_NAME = 100;
const MAX_INTRO = 200;
const MAX_ABOUT = 2000;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

const socialLinksSchema = new mongoose.Schema(
  {
    instagramLink: { type: String, default: "", trim: true },
    facebookLink: { type: String, default: "", trim: true },
    youtubeLink: { type: String, default: "", trim: true },
    linkedinLink: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    profilePhoto: {
      type: String,
      default: DEFAULT_PROFILE_PHOTO,
      trim: true,
    },
    truvedaLink: {
      type: String,
      required: [true, "truvedaLink is required"],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return TRUVEDA_PATTERN.test(v);
        },
        message: "truvedaLink may only contain letters, numbers, underscores",
      },
    },
    firstName: {
      type: String,
      required: [true, "firstName is required"],
      trim: true,
      maxlength: [MAX_FIRST_NAME, `firstName must be at most ${MAX_FIRST_NAME} characters`],
    },
    lastName: {
      type: String,
      required: [true, "lastName is required"],
      trim: true,
      maxlength: [MAX_LAST_NAME, `lastName must be at most ${MAX_LAST_NAME} characters`],
    },
    displayName: {
      type: String,
      required: [true, "displayName is required"],
      trim: true,
      maxlength: [MAX_DISPLAY_NAME, `displayName must be at most ${MAX_DISPLAY_NAME} characters`],
    },
    intro: {
      type: String,
      default: "",
      trim: true,
      maxlength: [MAX_INTRO, `intro must be at most ${MAX_INTRO} characters`],
    },
    aboutYourself: {
      type: String,
      default: "",
      trim: true,
      maxlength: [MAX_ABOUT, `aboutYourself must be at most ${MAX_ABOUT} characters`],
    },
    email: {
      type: String,
      required: [true, "email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return EMAIL_PATTERN.test(v);
        },
        message: "Please provide a valid email",
      },
    },
    socialLinks: {
      type: socialLinksSchema,
      default: () => ({
        instagramLink: "",
        facebookLink: "",
        youtubeLink: "",
        linkedinLink: "",
      }),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for fullName
userSchema.virtual("fullName").get(function () {
  const firstName = this.firstName ?? "";
  const lastName = this.lastName ?? "";
  return [firstName, lastName].filter(Boolean).join(" ").trim();
});

// Ensure virtuals are included in JSON
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ truvedaLink: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);

// Helper function to handle Mongoose validation errors
const handleValidationError = (error) => {
  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map((err) => err.message);
    throw new ValidationError(messages.join(", "));
  }
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    throw new ValidationError(`${field} already exists`);
  }
  throw error;
};

export const ensureUserIndexes = async () => {
  await User.createIndexes();
};

export const createUser = async (data) => {
  try {
    const user = new User(data);
    await user.save();
    return user.toObject();
  } catch (error) {
    handleValidationError(error);
  }
};

export const listUsers = async ({ page = 1, limit = 10, search = "" } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const skip = (pageNumber - 1) * limitNumber;
  const query = {};

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), "i");
    query.$or = [
      { firstName: regex },
      { lastName: regex },
      { displayName: regex },
      { email: regex },
      { truvedaLink: regex },
    ];
  }

  const [records, total] = await Promise.all([
    User.find(query)
      .skip(skip)
      .limit(limitNumber)
      .sort({ createdAt: -1 })
      .lean({ virtuals: true }),
    User.countDocuments(query),
  ]);

  return {
    data: records,
    total,
    totalPages: total ? Math.ceil(total / limitNumber) : 0,
    page: pageNumber,
    limit: limitNumber,
  };
};

export const findUserById = async (id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid user id");
    }
    const user = await User.findById(id).lean({ virtuals: true });
    return user;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("Invalid user id");
  }
};

export const findUserByEmail = async (email) => {
  if (!email || typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const user = await User.findOne({ email: normalized }).lean({ virtuals: true });
  return user;
};

export const findUserByTruvedaLink = async (link) => {
  if (!link || typeof link !== "string") return null;
  const normalized = link.trim().toLowerCase();
  if (!normalized) return null;
  const user = await User.findOne({ truvedaLink: normalized }).lean({ virtuals: true });
  return user;
};

export const updateUser = async (id, data) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid user id");
    }

    if (!data || !Object.keys(data).length) {
      throw new ValidationError("At least one field must be provided to update");
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });

    if (!user) {
      throw new ValidationError("User not found");
    }

    return user;
  } catch (error) {
    handleValidationError(error);
  }
};

export const deleteUser = async (id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid user id");
    }

    const user = await User.findByIdAndDelete(id).lean({ virtuals: true });
    if (!user) {
      throw new ValidationError("User not found");
    }
    return user;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("User not found");
  }
};

export default User;
