import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";

import { AppLayout } from "./layouts/AppLayout.js";
import { ManagementPage } from "../modules/admin/ManagementPage.js";
import { DailyLogPage } from "../modules/daily-log/DailyLogPage.js";
import { HomePage } from "../modules/home/HomePage.js";
import { NotificationPage } from "../modules/notification/NotificationPage.js";
import { ReservationPage } from "../modules/reservation/ReservationPage.js";
import { ResponseEntryPage } from "../modules/response/ResponseEntryPage.js";
import { ResponseListPage } from "../modules/response/ResponseListPage.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/response" element={<ResponseListPage />} />
          <Route path="/response/new" element={<ResponseEntryPage />} />
          <Route path="/reservation" element={<ReservationPage />} />
          <Route path="/daily-log/today" element={<DailyLogPage />} />
          <Route path="/staff" element={<ManagementPage />} />
          <Route path="/notification" element={<NotificationPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
