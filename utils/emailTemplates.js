/**
 * Premium HTML Email Templates for IDRMIS
 * Features: Responsive design, modern typography, card-based layout, and professional branding.
 */

const BASE_TEMPLATE = (title, content, footer) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f4f7f9; }
    .container { max-width: 600px; margin: 40px auto; padding: 0; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 60px 40px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 50px 40px; background-color: #ffffff; }
    .content p { margin-bottom: 24px; font-size: 16px; color: #4b5563; }
    .cta-container { text-align: center; margin: 40px 0; }
    .btn { background-color: #4f46e5; color: #ffffff !important; padding: 16px 32px; text-decoration: none; border-radius: 16px; font-weight: 700; font-size: 16px; display: inline-block; transition: all 0.3s ease; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2); }
    .code-box { background-color: #f9fafb; border: 2px dashed #e5e7eb; padding: 30px; border-radius: 20px; text-align: center; margin: 30px 0; }
    .code { font-size: 42px; font-weight: 900; letter-spacing: 12px; color: #4f46e5; font-family: 'Courier New', monospace; }
    .footer { padding: 40px; text-align: center; background-color: #f9fafb; border-top: 1px solid #f3f4f6; }
    .footer p { margin: 0; font-size: 13px; color: #9ca3af; font-weight: 500; }
    .logo-text { font-size: 12px; font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,0.4); text-transform: uppercase; margin-bottom: 20px; display: block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="logo-text">IDRMIS System Protocol</span>
      <h1>${title}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>${footer || 'This is an automated system transmission. Please do not reply.'}</p>
      <p style="margin-top: 10px;">&copy; 2026 Integrated Disaster Risk Management System</p>
    </div>
  </div>
</body>
</html>
`;

export const VERIFICATION_EMAIL_TEMPLATE = BASE_TEMPLATE(
    'Verify Identity',
    `
    <p>Welcome to the IDRMIS portal. To finalize your security clearance and activate your account, please enter the following administrative code:</p>
    <div class="code-box">
      <div class="code">{verificationCode}</div>
    </div>
    <p>This code is short-lived and will expire in <strong>15 minutes</strong>. If you did not initiate this request, please disregard this signal immediately.</p>
    `,
    'Secure Verification Protocol'
);

export const PASSWORD_RESET_REQUEST_TEMPLATE = BASE_TEMPLATE(
    'Reset Credentials',
    `
    <p>A request to reset your access credentials has been detected. To proceed with security re-validation, click the restricted link below:</p>
    <div class="cta-container">
      <a href="{resetURL}" class="btn">Re-validate Credentials</a>
    </div>
    <p>This secure link will remain active for <strong>60 minutes</strong>. If you did not request this, your account remains secure; no further action is required.</p>
    `,
    'Credential Reset Protocol'
);

export const PASSWORD_RESET_SUCCESS_TEMPLATE = BASE_TEMPLATE(
    'Update Successful',
    `
    <p>Your security credentials have been successfully updated. Your account is now fully re-secured and ready for operations.</p>
    <div style="text-align: center; margin: 40px 0;">
      <div style="background-color: #10b981; color: white; width: 64px; height: 64px; line-height: 64px; border-radius: 50%; display: inline-block; font-size: 32px; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.2);">
        &check;
      </div>
    </div>
    <p>If you did not authorize this change, please contact the system administrator immediately to lock your terminal.</p>
    `,
    'Security Integrity Verified'
);

export const WELCOME_EMAIL_TEMPLATE = BASE_TEMPLATE(
    'Welcome Onboard',
    `
    <p>Hello <strong>{name}</strong>,</p>
    <p>Welcome to <strong>IDRMIS</strong>! Your account has been verified and is now active within the disaster risk management network.</p>
    
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin: 28px 0;">
      <h3 style="margin-top: 0; color: #1e293b; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Your Login Credentials</h3>
      <p style="margin: 8px 0; font-size: 15px; color: #334155;"><strong>Email:</strong> <span style="font-family: monospace; color: #4f46e5;">{email}</span></p>
      <p style="margin: 8px 0; font-size: 15px; color: #334155;"><strong>Default Password:</strong> <span style="font-family: monospace; background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 8px; font-weight: 700;">{password}</span></p>
    </div>

    <p style="font-size: 14px; color: #64748b;">For your security, we strongly advise you to sign in and update your password from your account profile settings.</p>
    
    <div class="cta-container">
      <a href="{loginURL}" class="btn">Enter Command Center</a>
    </div>
    `,
    'Account Activation Protocol'
);

export const ACCOUNT_SETUP_TEMPLATE = BASE_TEMPLATE(
    'Terminal Provisioning',
    `
    <p>Your IDRMIS administrative account has been prepared by an authorizing officer.</p>
    <p>To initialize your access and set your permanent credentials, please engage the setup protocol below:</p>
    <div class="cta-container">
      <a href="{setupURL}" class="btn">Initialize Terminal</a>
    </div>
    <p>This provisioning link will remain active for <strong>24 hours</strong>. Please complete the setup at your earliest convenience.</p>
    `,
    'System Access Provisioning'
);
