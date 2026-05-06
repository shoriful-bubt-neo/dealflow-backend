type TResponse<T> = {
    success: boolean;
    message?: string;
    data?: T;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
    };
};

const sendResponse = <T>(
    res: any,
    {
        statusCode = 200,
        success = true,
        message,
        data,
        meta,
    }: TResponse<T> & { statusCode?: number }
) => {
    res.status(statusCode).json({
        success,
        message,
        meta,
        data,
    });
};

export default sendResponse;