// Type for brand signup and profile update file uploads
export type SignupFiles = {
  profileImage?: Express.Multer.File[];
  profileBanner?: Express.Multer.File[];
  incorporationDocument?: Express.Multer.File[];
  gstDocument?: Express.Multer.File[];
  panDocument?: Express.Multer.File[];
};
