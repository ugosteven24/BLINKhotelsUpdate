import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getHotelImages, uploadHotelImageAction, addHotelImageUrlAction, setCoverImageAction,
  updateImageAltAction, moveImageAction, deleteImageAction,
} from "@/services/admin/hotel-images";
import { Header } from "@/components/admin/ui";
import QuickForm from "@/components/admin/QuickForm";
import DeleteButton from "@/components/admin/DeleteButton";

export default async function HotelImagesPage({ params }) {
  const { id } = await params;
  const data = await getHotelImages(Number(id));
  if (!data) notFound();
  const { hotel, images, max } = data;
  return (
    <>
      <Header title={`${hotel.hotel_name} · Photos`} sub={`${images.length} of ${max} photos. The cover photo is what guests see first.`}>
        <Link className="adm-btn ghost" href={`/admin/hotels/${hotel.id}`}>Back to hotel</Link>
      </Header>

      <div className="adm-two">
        <div className="adm-card">
          <h2>Upload photos</h2>
          <QuickForm action={uploadHotelImageAction} className="adm-form">
            <input type="hidden" name="hotel_id" value={hotel.id} />
            <div className="adm-field full"><label htmlFor="file">Photos</label>
              <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp" multiple required />
              <small>Select up to 10 at once (hold Ctrl/Cmd or Shift). JPG, PNG or WebP, up to 5 MB each.</small></div>
            <div className="adm-field full"><label htmlFor="alt_text">Description (only used when uploading a single photo)</label>
              <input id="alt_text" name="alt_text" maxLength={255} placeholder="e.g. Pool at sunset" /></div>
            <p><button className="adm-btn" disabled={images.length >= max}>Upload</button></p>
          </QuickForm>
        </div>
        <div className="adm-card">
          <h2>Or use an image link</h2>
          <QuickForm action={addHotelImageUrlAction} className="adm-form">
            <input type="hidden" name="hotel_id" value={hotel.id} />
            <div className="adm-field full"><label htmlFor="url">Image address</label>
              <input id="url" name="url" type="url" placeholder="https://…" required />
              <small>Must start with https://. The photo stays on the other site.</small></div>
            <div className="adm-field full"><label htmlFor="alt_url">Description</label>
              <input id="alt_url" name="alt_text" maxLength={255} /></div>
            <p><button className="adm-btn" disabled={images.length >= max}>Add link</button></p>
          </QuickForm>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="adm-tablewrap"><div className="adm-empty">No photos yet. Add at least one so guests can see the hotel.</div></div>
      ) : (
        <div className="adm-gallery">
          {images.map((img, i) => (
            <div key={img.id} className={`adm-photo${img.is_cover ? " cover" : ""}`}>
              <div className="adm-photo-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.image_path} alt={img.alt_text ?? ""} loading="lazy" />
                {!!img.is_cover && <span className="adm-badge ok adm-photo-tag">Cover</span>}
              </div>
              <QuickForm action={updateImageAltAction} className="adm-photo-alt">
                <input type="hidden" name="id" value={img.id} />
                <input name="alt_text" defaultValue={img.alt_text ?? ""} maxLength={255} placeholder="Description" aria-label="Description" />
                <button className="adm-btn ghost sm">Save</button>
              </QuickForm>
              <div className="adm-inline">
                {!img.is_cover && (
                  <QuickForm action={setCoverImageAction}><input type="hidden" name="id" value={img.id} /><button className="adm-btn sm">Make cover</button></QuickForm>
                )}
                <QuickForm action={moveImageAction}><input type="hidden" name="id" value={img.id} /><input type="hidden" name="dir" value="up" />
                  <button className="adm-btn ghost sm" disabled={i === 0} aria-label="Move earlier">←</button></QuickForm>
                <QuickForm action={moveImageAction}><input type="hidden" name="id" value={img.id} /><input type="hidden" name="dir" value="down" />
                  <button className="adm-btn ghost sm" disabled={i === images.length - 1} aria-label="Move later">→</button></QuickForm>
                <DeleteButton action={deleteImageAction} args={[img.id]} title="Remove this photo?"
                  text={img.is_cover ? "This is the cover photo. The next photo becomes the cover." : "Guests will no longer see it."} confirmText="Yes, remove">Remove</DeleteButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
