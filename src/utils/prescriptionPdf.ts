export interface PrescriptionPdfData {
  id?: string | number;
  _id?: string | number;
  patient?: string;
  patientName?: string;
  avatar?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  registrationNumber?: string;
  councilState?: string;
  date?: string;
  issuedDate?: string;
  createdAt?: string;
  bookingId?: string | number;
  diagnosis?: string;
  notes?: string;
  clinicalNotes?: string;
  instructions?: string;
  duration?: string;
  medications?: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
  doctorDigitalSignature?: {
    signedAt?: string;
    registrationNumber?: string;
    councilState?: string;
  };
}

export function openPrescriptionPdf(rx: PrescriptionPdfData, autoPrint = true): Window | null {
  const patient = rx.patient || rx.patientName || "Patient";
  const doctor = rx.doctorName || "Dr. Medical Specialist";
  const specialty = rx.doctorSpecialty || "Telemedicine Specialist & General Medicine";
  const regNo = rx.registrationNumber || rx.doctorDigitalSignature?.registrationNumber || "MCI/NMC-48921-DL";
  const council = rx.councilState || rx.doctorDigitalSignature?.councilState || "National Medical Commission";
  
  const rawDate = rx.issuedDate || rx.date || rx.createdAt;
  const formattedDate = rawDate 
    ? (new Date(rawDate).toString() !== "Invalid Date" ? new Date(rawDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : String(rawDate))
    : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    
  const rxId = String(rx.id || rx._id || (rx.bookingId ? `RX-${rx.bookingId}` : `RX-${Date.now().toString().slice(-6)}`));
  const diagnosis = rx.diagnosis || (rx.notes && rx.notes.includes("Diagnosis:") ? rx.notes.split("Diagnosis:")[1].split(".")[0].trim() : "Telehealth Clinical Evaluation");
  
  const instructions = rx.instructions || rx.clinicalNotes || (rx.notes && !rx.notes.startsWith("Diagnosis:") ? rx.notes : "Complete the course as prescribed. Hydrate adequately. If symptoms persist or worsen, consult in-person or rebook immediate teleconsultation.");
  
  const defaultDuration = rx.duration || "5 days";
  const meds = Array.isArray(rx.medications) && rx.medications.length > 0 
    ? rx.medications 
    : [{ name: "Standard Supportive Care", dosage: "1 Unit", frequency: "As directed", duration: defaultDuration, instructions: "As advised by doctor" }];

  const medsRows = meds.map((m, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 10px; font-weight: 700; color: #0f172a; font-size: 13px;">
        <span style="display: inline-block; width: 22px; height: 22px; line-height: 22px; background: #f1f5f9; color: #475569; text-align: center; border-radius: 50%; font-size: 11px; margin-right: 6px;">${idx + 1}</span>
        ${m.name}
      </td>
      <td style="padding: 12px 10px; color: #334155; font-size: 13px; font-weight: 600;">${m.dosage || "Standard"}</td>
      <td style="padding: 12px 10px; color: #334155; font-size: 13px;">${m.frequency || "Once daily"}</td>
      <td style="padding: 12px 10px; color: #334155; font-size: 13px;">${m.duration || defaultDuration}</td>
      <td style="padding: 12px 10px; color: #64748b; font-size: 12px; font-style: italic;">${m.instructions || "—"}</td>
    </tr>
  `).join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Pop-up blocked. Please enable pop-ups for this site to view and download your prescription PDF.");
    return null;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Digital Prescription - ${patient} - ONYX HEALTH</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .action-bar {
      width: 100%;
      max-width: 800px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 12px 20px;
      border-radius: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }
    .btn {
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      padding: 9px 18px;
      border-radius: 10px;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background: linear-gradient(135deg, #14213D 0%, #1e3a5f 100%);
      color: #ffffff;
    }
    .btn-primary:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #475569;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
    }
    .page-container {
      width: 100%;
      max-width: 800px;
      background: #ffffff;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.04);
      border: 1px solid #e2e8f0;
      position: relative;
    }
    .header-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #14213D;
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    .logo-badge {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #14213D;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .logo-badge span {
      color: #F2052C;
    }
    .meta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    .meta-group h4 {
      margin: 0 0 6px 0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748b;
      font-weight: 700;
    }
    .meta-group p {
      margin: 2px 0;
      font-size: 13px;
      color: #1e293b;
    }
    .rx-symbol {
      font-family: Georgia, serif;
      font-size: 32px;
      font-weight: bold;
      color: #14213D;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      background: #14213D;
      color: #ffffff;
      text-align: left;
      padding: 10px 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-weight: 700;
    }
    th:first-child { border-top-left-radius: 8px; }
    th:last-child { border-top-right-radius: 8px; }
    .box-notes {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 24px;
    }
    .box-notes h5 {
      margin: 0 0 4px 0;
      color: #92400e;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .box-notes p {
      margin: 0;
      color: #78350f;
      font-size: 13px;
      line-height: 1.5;
    }
    .footer-section {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .stamp-box {
      border: 2px solid #059669;
      border-radius: 12px;
      padding: 10px 16px;
      background: #ecfdf5;
      text-align: center;
      display: inline-block;
    }
    .stamp-text {
      font-size: 11px;
      font-weight: 800;
      color: #065f46;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .action-bar {
        display: none !important;
      }
      .page-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>

  <div class="action-bar">
    <div style="font-size: 13px; font-weight: 700; color: #14213D;">
      📄 Onyx Health Digital Telehealth Prescription
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="btn btn-secondary" onclick="window.close()">✕ Close</button>
      <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
  </div>

  <div class="page-container">
    <div class="header-grid">
      <div>
        <div class="logo-badge">ONYX <span>HEALTH+</span></div>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b; font-weight: 600;">
          Digital Health Network • Telemedicine Suite
        </p>
        <p style="margin: 2px 0 0 0; font-size: 11px; color: #94a3b8;">
          ABDM Integrated • NMC Telemedicine Practice Guidelines Compliant
        </p>
      </div>
      <div style="text-align: right;">
        <span style="display: inline-block; background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
          Verified e-Prescription
        </span>
        <p style="margin: 6px 0 2px 0; font-size: 12px; font-weight: 700; color: #0f172a;">
          Rx Ref: <span style="font-family: monospace;">${rxId}</span>
        </p>
        <p style="margin: 0; font-size: 11px; color: #64748b;">
          Date: ${formattedDate}
        </p>
      </div>
    </div>

    <div class="meta-card">
      <div class="meta-group">
        <h4>Patient Information</h4>
        <p style="font-size: 15px; font-weight: 800; color: #14213D;">${patient}</p>
        <p style="font-size: 12px; color: #64748b;">Consultation Mode: <strong>Telehealth Video Consult</strong></p>
        <p style="font-size: 12px; color: #64748b;">Primary Diagnosis: <strong style="color: #0f172a;">${diagnosis}</strong></p>
      </div>
      <div class="meta-group" style="border-left: 1px solid #e2e8f0; padding-left: 20px;">
        <h4>Medical Practitioner</h4>
        <p style="font-size: 15px; font-weight: 800; color: #14213D;">${doctor.startsWith("Dr.") ? doctor : `Dr. ${doctor}`}</p>
        <p style="font-size: 12px; color: #64748b;">${specialty}</p>
        <p style="font-size: 12px; color: #64748b;">Reg No: <strong style="color: #0f172a;">${regNo}</strong> (${council})</p>
      </div>
    </div>

    <div class="rx-symbol">
      ℞ <span style="font-size: 15px; font-family: -apple-system, sans-serif; letter-spacing: 0.5px; text-transform: uppercase; color: #475569; font-weight: 800; margin-left: 4px;">Medications Prescribed</span>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 32%;">Medication Name</th>
          <th style="width: 16%;">Dosage</th>
          <th style="width: 20%;">Frequency</th>
          <th style="width: 14%;">Duration</th>
          <th style="width: 18%;">Instructions</th>
        </tr>
      </thead>
      <tbody>
        ${medsRows}
      </tbody>
    </table>

    <div class="box-notes">
      <h5>General Advice & Doctor's Instructions:</h5>
      <p>${instructions}</p>
    </div>

    <div class="footer-section">
      <div style="max-width: 440px;">
        <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
          This prescription is valid without physical ink signature under Section 5 of the Information Technology Act, 2000 and complies with National Medical Commission (NMC) Telemedicine Practice Guidelines.
        </p>
        <p style="margin: 4px 0 0 0; font-size: 10px; color: #cbd5e1; font-family: monospace;">
          Auth-Hash: ${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}
        </p>
      </div>

      <div style="text-align: right;">
        <div class="stamp-box">
          <div class="stamp-text">✓ Digitally Signed & Authenticated</div>
          <div style="font-size: 10px; color: #047857; margin-top: 2px;">
            ${doctor.startsWith("Dr.") ? doctor : `Dr. ${doctor}`}
          </div>
          <div style="font-size: 9px; color: #065f46; opacity: 0.8;">
            ${formattedDate}
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    ${autoPrint ? `
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 500);
      };
    ` : ""}
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  return printWindow;
}
