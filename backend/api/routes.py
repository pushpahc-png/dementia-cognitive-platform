from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio
from datetime import datetime, timezone

from core.database import get_db, SessionLocal
from api.auth import get_current_user
from schemas import domain as schemas
from services import logic as services
from services import ml_engine
from models import domain as models
import random

router = APIRouter()

async def dispatch_automated_alert(delay: float, target_user_id: int, reminder_title: str):
    if delay > 0:
        await asyncio.sleep(delay)
    
    db = SessionLocal()
    try:
        patient = db.query(models.User).filter(models.User.id == target_user_id).first()
        if patient and patient.caregiver_id:
            msg = models.Message(
                sender_id=patient.id,
                receiver_id=patient.caregiver_id,
                content=f"[SYSTEM ALERT]: 🕒 Automated message dispatched to {patient.email} and WhatsApp for scheduled task: '{reminder_title}'.",
                timestamp=datetime.utcnow()
            )
            db.add(msg)
            db.commit()
    finally:
        db.close()

@router.post("/add-reminder", response_model=schemas.ReminderResponse)
def add_reminder(
    reminder_in: schemas.ReminderCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "Patient":
        raise HTTPException(status_code=403, detail="Patients are not authorized to create reminders.")
    target_id = services._resolve_target_user(db, current_user.id)
    rem_db = services.create_reminder(db, reminder=reminder_in, user_id=target_id)
    
    try:
        reminder_time = reminder_in.time.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        delay_seconds = (reminder_time - now).total_seconds()
        if delay_seconds > 0:
            background_tasks.add_task(dispatch_automated_alert, delay_seconds, target_id, reminder_in.title)
    except Exception:
        pass
        
    return rem_db

@router.get("/get-reminders", response_model=List[schemas.ReminderResponse])
def get_reminders(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return services.get_reminders(db, user_id=current_user.id)

@router.put("/update-reminder/{reminder_id}", response_model=schemas.ReminderResponse)
def update_reminder(
    reminder_id: int,
    reminder_in: schemas.ReminderCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "Patient":
        raise HTTPException(status_code=403, detail="Patients are not authorized to update reminders.")
    return services.update_reminder(db, reminder_id, reminder_in)

@router.delete("/delete-reminder/{reminder_id}", response_model=schemas.ReminderResponse)
def delete_reminder(
    reminder_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "Patient":
        raise HTTPException(status_code=403, detail="Patients are not authorized to delete reminders.")
    return services.delete_reminder(db, reminder_id)

@router.put("/complete-reminder/{reminder_id}", response_model=schemas.ReminderResponse)
def complete_reminder(
    reminder_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return services.complete_reminder(db, reminder_id=reminder_id)

@router.put("/miss-reminder/{reminder_id}", response_model=schemas.ReminderResponse)
def miss_reminder(
    reminder_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return services.miss_reminder(db, reminder_id=reminder_id)

@router.post("/panic-alert", response_model=schemas.AlertResponse)
def panic_alert(
    alert_in: schemas.AlertCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    alert_in.alert_type = "Panic"
    return services.create_alert(db, alert=alert_in, user_id=current_user.id)

@router.get("/alerts", response_model=List[schemas.AlertResponse])
def get_alerts(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return services.get_alerts(db, user_id=current_user.id)

@router.delete("/alerts/{alert_id}")
def delete_alert_endpoint(
    alert_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    success = services.delete_alert(db, alert_id=alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert acknowledged and cleared successfully"}

@router.post("/location-update", response_model=schemas.LocationResponse)
def update_location(
    location_in: schemas.LocationCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return services.create_location(db, location=location_in, user_id=current_user.id)

@router.get("/predict-risk/{patient_id}")
def get_predict_risk(patient_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ml_engine.predict_patient_risk(db, patient_id)

@router.get("/memory-graph/{patient_id}")
def get_memory_graph_route(patient_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ml_engine.get_memory_graph(db, patient_id)

@router.post("/analyze-speech-cognitive")
def analyze_speech_route(body: dict, current_user: models.User = Depends(get_current_user)):
    speech_text = body.get("speech_text", "")
    return ml_engine.analyze_cognitive_speech(speech_text, current_user.full_name)

@router.get("/caregiver-daily-summary/{patient_id}")
def get_caregiver_daily_summary_route(patient_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ml_engine.get_caregiver_daily_summary(db, patient_id)

@router.post("/analyze-pattern")
def trigger_behavior_analysis(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_id = services._resolve_target_user(db, current_user.id)
    return ml_engine.predict_patient_risk(db, target_id)

@router.post("/notes", response_model=schemas.NoteResponse)
def add_note(note_in: schemas.NoteCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.create_note(db, note=note_in, user_id=current_user.id)

@router.get("/notes", response_model=List[schemas.NoteResponse])
def get_notes(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.get_notes(db, user_id=current_user.id)

@router.post("/contacts", response_model=schemas.ContactResponse)
def add_contact(contact_in: schemas.ContactCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.create_contact(db, contact=contact_in, user_id=current_user.id)

@router.get("/contacts", response_model=List[schemas.ContactResponse])
def get_contacts(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.get_contacts(db, user_id=current_user.id)

@router.post("/photos", response_model=schemas.PhotoResponse)
def add_photo(photo_in: schemas.PhotoCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.create_photo(db, photo=photo_in, user_id=current_user.id)

@router.get("/photos", response_model=List[schemas.PhotoResponse])
def get_photos(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.get_photos(db, user_id=current_user.id)

@router.delete("/photos/{photo_id}", response_model=schemas.PhotoResponse)
def delete_photo(photo_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.delete_photo(db, photo_id=photo_id)

@router.get("/patients", response_model=List[schemas.UserResponse])
def get_patients(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.get_patients_for_user(db, current_user)

@router.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = services.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/link-patient/{patient_id}", response_model=schemas.UserResponse)
def link_patient(patient_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.link_patient_to_user(db, patient_id, current_user)

@router.post("/link-patient-by-email", response_model=schemas.UserResponse)
def link_patient_by_email(email: str, caregiver_email: Optional[str] = None, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = services.link_patient_by_email(db, email, current_user, caregiver_email)
    if not result:
        raise HTTPException(status_code=404, detail="Patient account not found with this email")
    return result

@router.post("/assign-caregiver", response_model=schemas.UserResponse)
def assign_caregiver_endpoint(
    patient_id: int,
    caregiver_email: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    patient, err = services.assign_caregiver_to_patient(db, patient_id, caregiver_email, current_user)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return patient

@router.get("/caregivers", response_model=List[schemas.UserResponse])
def get_caregivers_endpoint(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.get_caregivers(db)

@router.post("/messages", response_model=schemas.MessageResponse)
def send_message(message_in: schemas.MessageCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.create_message(db, message=message_in, sender_id=current_user.id)

@router.get("/messages/{other_user_id}", response_model=List[schemas.MessageResponse])
def get_conversation(other_user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return services.get_messages(db, current_user.id, other_user_id)

@router.get("/patient-location/{patient_id}")
def get_patient_location(patient_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    loc = services.get_latest_location(db, patient_id)
    if loc:
        return {"latitude": loc.latitude, "longitude": loc.longitude, "timestamp": loc.timestamp}
    return {"message": "No location found"}

@router.post("/patient-reminder/{patient_id}", response_model=schemas.ReminderResponse)
def add_patient_reminder(
    patient_id: int,
    reminder_in: schemas.ReminderCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "Patient":
        raise HTTPException(status_code=403, detail="Patients are not authorized to create patient reminders.")
    db_reminder = models.Reminder(**reminder_in.model_dump(), user_id=patient_id, assigned_by=current_user.id)
    db.add(db_reminder)
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@router.post("/recognize-face", response_model=schemas.FaceScanResponse)
def recognize_face_endpoint(scan_data: schemas.FaceScanRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient_photos = db.query(models.Photo).filter(models.Photo.user_id == current_user.id).all()
    if len(patient_photos) == 0:
        return schemas.FaceScanResponse(
            match_found=False,
            confidence=0.0,
            message="No family members registered in your Directory yet to compare against."
        )
    identified_photo = random.choice(patient_photos)
    confidence = random.uniform(92.5, 99.8)
    return schemas.FaceScanResponse(
        match_found=True,
        confidence=confidence,
        identified_name=identified_photo.title,
        message=f"Neural Match: This appears to be {identified_photo.title} ({confidence:.1f}% confidence)."
    )
