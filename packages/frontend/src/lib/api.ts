import type { ApiRoutes } from "@backend/lambda-api/routes/index";

import { ApiClient } from "./api-client";

export const api = new ApiClient<ApiRoutes>();
