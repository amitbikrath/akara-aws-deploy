#!/usr/bin/env bash
# Switch Cognito (akara-users) from the 50/day COGNITO_DEFAULT sender to SES (akara.studio).
# Safe to run any time: it refuses until BOTH DKIM is verified AND SES is out of sandbox.
set -euo pipefail
export AWS_PAGER=""
R=us-east-1; POOL=us-east-1_CNN6r6A1G; ACCT=738983679688; DOMAIN=akara.studio
FROM="Akara <noreply@akara.studio>"

DKIM=$(aws sesv2 get-email-identity --region $R --email-identity $DOMAIN --query 'DkimAttributes.Status' --output text)
PROD=$(aws sesv2 get-account --region $R --query 'ProductionAccessEnabled' --output text)
echo "DKIM=$DKIM  ProductionAccess=$PROD"
[ "$DKIM" = "SUCCESS" ] || { echo "STOP: DKIM not verified yet — add the 3 CNAMEs in Squarespace and wait."; exit 1; }
[ "$PROD" = "True" ]     || { echo "STOP: SES still in sandbox — wait for AWS approval email."; exit 1; }

# update-user-pool resets unspecified fields: pass everything that matters.
aws cognito-idp update-user-pool --region $R --user-pool-id $POOL \
  --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false,"TemporaryPasswordValidityDays":7}}' \
  --auto-verified-attributes email \
  --account-recovery-setting '{"RecoveryMechanisms":[{"Priority":1,"Name":"verified_email"},{"Priority":2,"Name":"verified_phone_number"}]}' \
  --admin-create-user-config '{"AllowAdminCreateUserOnly":false}' \
  --verification-message-template DefaultEmailOption=CONFIRM_WITH_CODE \
  --mfa-configuration OFF --user-pool-tags Project=akara \
  --deletion-protection ACTIVE --user-pool-tier PLUS --user-pool-add-ons AdvancedSecurityMode=ENFORCED \
  --email-configuration "EmailSendingAccount=DEVELOPER,SourceArn=arn:aws:ses:$R:$ACCT:identity/$DOMAIN,From=$FROM"

aws cognito-idp describe-user-pool --region $R --user-pool-id $POOL --query 'UserPool.EmailConfiguration' --output json
echo "DONE. Test: sign up with a fresh email on https://www.akara.studio and confirm the code arrives from noreply@akara.studio."
