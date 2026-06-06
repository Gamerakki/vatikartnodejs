export interface RegisterUserRequest {
  first_name: string;
  last_name?: string;
  username: string; // Email ID or Mobile No.
  password: string;
}

export interface LoginUser {
  username: string; // Email ID or Mobile No.
  password: string;
}

export interface UserBasicData {
  first_name: string;
  last_name?: string | null;
  profile_pic_path?: string | null;
}

export interface UserLoginResponse {
  user_basic_data: UserBasicData;
  token: string;
}
