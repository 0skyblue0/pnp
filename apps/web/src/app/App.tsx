import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";

import { AppLayout } from "./layouts/AppLayout.js";
import { ManagementPage } from "../modules/admin/ManagementPage.js";
import { DailyLogPage } from "../modules/daily-log/DailyLogPage.js";
import { HomePage } from "../modules/home/HomePage.js";
import { NotificationPage } from "../modules/notification/NotificationPage.js";
import { PrepaidLedgerPage } from "../modules/prepaid-ledger/PrepaidLedgerPage.js";
import { RegularCustomerPage } from "../modules/regular-customer/RegularCustomerPage.js";
import { ReservationPage } from "../modules/reservation/ReservationPage.js";
import { ResponseEntryPage } from "../modules/response/ResponseEntryPage.js";
import { ResponseInquiryPage } from "../modules/response/ResponseInquiryPage.js";
import { SalesAnalysisPage } from "../modules/sales-analysis/SalesAnalysisPage.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/operation" element={<Navigate to="/daily-log/today" replace />} />
          <Route path="/response" element={<ResponseInquiryPage />} />
          <Route path="/response/new" element={<ResponseEntryPage />} />
          <Route path="/statistics" element={<Navigate to="/response?tab=stats" replace />} />
          <Route path="/sales-analysis" element={<SalesAnalysisPage />} />
          <Route path="/regular-customer" element={<RegularCustomerPage />} />
          <Route path="/prepaid-ledger" element={<PrepaidLedgerPage />} />
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
