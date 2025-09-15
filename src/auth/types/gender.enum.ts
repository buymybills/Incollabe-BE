export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHERS = 'Others',
}

export enum OthersGenderOptions {
  ABINARY = 'Abinary',
  TRANS_WOMEN = 'Trans-Women',
  GAY = 'Gay',
  BINARY = 'Binary',
  TRANS_FEMININE = 'Trans-Feminine',
}

export type GenderType = `${Gender}`;
export type OthersGenderType = `${OthersGenderOptions}`;

export const GENDER_OPTIONS = Object.values(Gender);
export const OTHERS_GENDER_OPTIONS = Object.values(OthersGenderOptions);