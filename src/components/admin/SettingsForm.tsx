"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { refreshPublicSite } from "@/app/admin/actions";
import { loadSettings, saveSettings } from "@/lib/admin/api";
import type { SiteSettings } from "@/lib/types";
import { CountryPicker } from "./CountryPicker";
import { PortraitField } from "./PortraitField";
import { RichTextEditor } from "./RichTextEditor";

type Notice = { kind: "ok" | "error"; text: string } | null;

const describe = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

/** Site-wide text and options: name, About page, extra countries, home base. */
export function SettingsForm() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [initialAbout, setInitialAbout] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        setInitialAbout(loaded.about_html);
      })
      .catch((error) => !cancelled && setNotice({ kind: "error", text: describe(error) }));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!settings) {
    return (
      <p className={notice ? "text-danger" : "meta"} role="status">
        {notice?.text ?? "Loading settings…"}
      </p>
    );
  }

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setSettings((current) => (current ? { ...current, [key]: value } : current));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;

    const validHome =
      Number.isFinite(settings.home_lat) &&
      Number.isFinite(settings.home_lng) &&
      Math.abs(settings.home_lat) <= 90 &&
      Math.abs(settings.home_lng) <= 180;
    if (!settings.site_title.trim() || !validHome) {
      setNotice({
        kind: "error",
        text: !validHome
          ? "Home latitude must be between -90 and 90, longitude between -180 and 180."
          : "The site needs a name.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      await saveSettings({ ...settings, site_title: settings.site_title.trim() });
      await refreshPublicSite();
      setNotice({ kind: "ok", text: "Saved. Live on the site now." });
    } catch (error) {
      setNotice({ kind: "error", text: describe(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="max-w-3xl">
      <h1 className="display text-5xl sm:text-6xl">Settings</h1>

      <section aria-labelledby="site-heading" className="mt-10 border-t border-ink pt-6">
        <h2 id="site-heading" className="display text-3xl">
          Site
        </h2>
        <div className="mt-6 space-y-6">
          <div>
            <label htmlFor="site-title" className="label">
              Site name
            </label>
            <input
              id="site-title"
              type="text"
              className="field"
              value={settings.site_title}
              onChange={(event) => set("site_title", event.target.value)}
            />
            <p className="hint">Shown in the header, browser tab and link previews.</p>
          </div>
          <div>
            <label htmlFor="site-description" className="label">
              One-line description
            </label>
            <textarea
              id="site-description"
              rows={2}
              maxLength={200}
              className="field resize-y"
              value={settings.site_description}
              onChange={(event) => set("site_description", event.target.value)}
            />
            <p className="hint">Used by search engines and link previews. Leave empty for a plain default.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="about-heading" className="mt-14 border-t border-ink pt-6">
        <h2 id="about-heading" className="display text-3xl">
          About page
        </h2>
        <div className="mt-6">
          <RichTextEditor
            initialValue={initialAbout}
            onChange={(html) => set("about_html", html)}
            label="About page text"
            placeholder="A few lines about you and this site."
          />
        </div>

        <div className="mt-10">
          <p className="label">Your photo</p>
          <PortraitField
            portrait={settings.portrait}
            onChange={(portrait) => set("portrait", portrait)}
            onError={(text) => setNotice({ kind: "error", text })}
          />
          <label htmlFor="portrait-alt" className="label mt-6">
            Photo description
          </label>
          <input
            id="portrait-alt"
            type="text"
            className="field"
            placeholder="e.g. Avi on the harbour in Tromsø"
            value={settings.portrait_alt}
            onChange={(event) => set("portrait_alt", event.target.value)}
          />
          <p className="hint">
            Read aloud by screen readers in place of the photo. Saved with the Save settings button.
          </p>
        </div>
      </section>

      <section aria-labelledby="countries-heading" className="mt-14 border-t border-ink pt-6">
        <h2 id="countries-heading" className="display text-3xl">
          Other countries visited
        </h2>
        <p className="hint max-w-2xl">
          Countries you have been to but have not written a trip for yet. They are filled in on the map and
          counted in the totals. Countries that already have a published trip count on their own.
        </p>
        <div className="mt-5">
          <label htmlFor="extra-countries" className="sr-only">
            Other countries visited
          </label>
          <CountryPicker
            id="extra-countries"
            value={settings.extra_country_codes}
            onChange={(codes) => set("extra_country_codes", codes)}
          />
        </div>
      </section>

      <section aria-labelledby="home-heading" className="mt-14 border-t border-ink pt-6">
        <h2 id="home-heading" className="display text-3xl">
          Home base
        </h2>
        <p className="hint max-w-2xl">Routes on the maps start here, and distances are measured from here.</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="home-name" className="label">
              Name
            </label>
            <input
              id="home-name"
              type="text"
              className="field"
              value={settings.home_name}
              onChange={(event) => set("home_name", event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="home-code" className="label">
              Airport code
            </label>
            <input
              id="home-code"
              type="text"
              maxLength={4}
              className="field uppercase"
              value={settings.home_code}
              onChange={(event) => set("home_code", event.target.value.toUpperCase())}
            />
            <p className="hint">Printed large on each trip&rsquo;s boarding pass.</p>
          </div>
          <div>
            <label htmlFor="home-lat" className="label">
              Latitude
            </label>
            <input
              id="home-lat"
              type="number"
              step="any"
              className="field"
              value={Number.isFinite(settings.home_lat) ? settings.home_lat : ""}
              onChange={(event) => set("home_lat", event.target.valueAsNumber)}
            />
          </div>
          <div>
            <label htmlFor="home-lng" className="label">
              Longitude
            </label>
            <input
              id="home-lng"
              type="number"
              step="any"
              className="field"
              value={Number.isFinite(settings.home_lng) ? settings.home_lng : ""}
              onChange={(event) => set("home_lng", event.target.valueAsNumber)}
            />
            <p className="hint">West and south are negative, e.g. Charlotte is 35.2271, -80.8431.</p>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper">
        <div className="shell flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2.5">
          <p role="status" className={notice?.kind === "error" ? "text-sm text-danger" : "text-sm text-soft"}>
            {notice?.text ?? "Changes apply to the public site when you save."}
          </p>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </form>
  );
}
