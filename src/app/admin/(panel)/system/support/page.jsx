import { getSupportSettings, saveSupportSettingsAction } from "@/services/admin/system";
import ActionForm, { Field } from "@/components/admin/ActionForm";
import { Header } from "@/components/admin/ui";

export default async function Page() {
  const s = await getSupportSettings();
  return (
    <>
      <Header title="Support Settings" sub="Contact details shown to guests and hotels." />
      <div className="adm-card">
        <ActionForm action={saveSupportSettingsAction}>
          <Field name="support_email" labelText="Support email" type="email" defaultValue={s.support_email} />
          <Field name="support_phone" labelText="Support phone" defaultValue={s.support_phone} />
          <Field name="whatsapp_number" labelText="WhatsApp number" defaultValue={s.whatsapp_number} hint="Include country code." />
          <Field name="support_hours" labelText="Support hours" defaultValue={s.support_hours} />
          <Field name="help_center_url" labelText="Help center URL" type="url" defaultValue={s.help_center_url} full />
        </ActionForm>
      </div>
    </>
  );
}
