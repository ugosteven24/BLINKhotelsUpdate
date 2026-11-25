import { getPlatformSettings, savePlatformSettingsAction } from "@/services/admin/system";
import ActionForm, { Field } from "@/components/admin/ActionForm";
import { Header } from "@/components/admin/ui";

export default async function Page() {
  const s = await getPlatformSettings();
  return (
    <>
      <Header title="Platform Settings" sub="Defaults used across the marketplace. Changes apply to new reservations." />
      <div className="adm-card">
        <ActionForm action={savePlatformSettingsAction}>
          <Field name="site_name" labelText="Site name" defaultValue={s.site_name} required />
          <Field name="default_currency" labelText="Default currency" defaultValue={s.default_currency} maxLength={3} required hint="3-letter code, e.g. NGN." />
          <Field name="default_commission_rate" labelText="Default commission (%)" type="number" step="0.01" min="0" max="100" defaultValue={s.default_commission_rate} />
          <Field name="tax_rate" labelText="Tax rate (%)" type="number" step="0.01" min="0" max="100" defaultValue={s.tax_rate} />
          <Field name="reservation_hold_minutes" labelText="Payment hold (minutes)" type="number" min="1" defaultValue={s.reservation_hold_minutes} hint="How long rooms are held while a guest pays." />
          <Field name="approval_window_hours" labelText="Hotel approval window (hours)" type="number" min="1" defaultValue={s.approval_window_hours} hint="How long a hotel has to approve a paid reservation." />
          <div className="adm-field full"><label className="adm-inline"><input type="checkbox" name="maintenance_mode" value="true" defaultChecked={s.maintenance_mode === "true"} /> Maintenance mode</label>
            <small>Your public site must read this setting to show a maintenance page.</small></div>
        </ActionForm>
      </div>
    </>
  );
}
