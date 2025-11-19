class ApiResponse {
  statusCode: number;
  success: boolean;
  message: string;
  data: any;

  constructor(statusCode: number, data: any, message = 'Success') {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }
}

export default ApiResponse;
