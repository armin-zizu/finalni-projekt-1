# Uputstvo za potpuno brisanje korisnika iz Firebase

## Problem
Kada se korisnik obriše iz Firestore kroz admin panel, korisnik se **NE briše** iz Firebase Authentication. To znači da email još uvijek postoji u Firebase Auth i korisnik se može ponovo prijaviti.

## Rješenje: Potpuno brisanje korisnika

### Korak 1: Obriši korisnika iz Firebase Authentication

1. Otvori Firebase Console: https://console.firebase.google.com/
2. Odaberi svoj projekt
3. Idi na **Authentication** u lijevom meniju
4. Pronađi korisnika po email adresi
5. Klikni na tri tačke (⋮) pored korisnika
6. Odaberi **Delete user**
7. Potvrdi brisanje

### Korak 2: Obriši korisnika iz Firestore (ako već nije obrisan)

1. U Firebase Console, idi na **Firestore Database**
2. Pronađi dokument u `users` kolekciji sa email adresom korisnika
3. Obriši dokument (ili koristi admin panel funkciju "Trajno Obriši Korisnika")

### Korak 3: Obriši device dokumente (ako postoje)

1. U Firestore Database, idi na `devices` kolekciju
2. Pronađi sve dokumente gdje je `userEmail` jednak email adresi korisnika
3. Obriši sve te dokumente

## Alternativno: Korištenje Admin Panel funkcije

Admin panel funkcija "Trajno Obriši Korisnika" briše:
- ✅ Sve obračune korisnika
- ✅ Svu pretplatu i historiju uplata
- ✅ Sve cache podatke
- ✅ Sve draft obračune
- ✅ Sve uređaje korisnika (iz Firestore)
- ✅ Svi podaci korisnika (iz Firestore)

**ALI NE briše korisnika iz Firebase Authentication!**

Zato je potrebno ručno obrisati korisnika iz Firebase Authentication (Korak 1).

## Provjera da li je korisnik potpuno obrisan

Nakon brisanja, pokušaj se registrovati sa istim emailom:
- Ako dobiješ grešku "Ovaj e-mail je već registriran" → korisnik još uvijek postoji u Firebase Auth
- Ako se registracija uspije → korisnik je potpuno obrisan

## Napomena

Brisanje korisnika iz Firebase Authentication je **trajno** i **nepovratno**. Korisnik će morati ponovo kreirati account sa istim emailom.

