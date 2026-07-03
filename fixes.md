# Fixes Log

## Invoice payload and billing UI alignment

### What changed
- Expanded the invoice API response so it now includes a nested `student` object instead of only `student_id`.
- Added a full nested `school_class` object inside the invoice student snapshot.
- Updated invoice queries to eagerly load `student.school_class` so the API can serialize the nested class data reliably.
- Updated the billing invoice list UI to render the real student name and class name from the nested payload.
- Updated the invoice detail page to show the student's assigned class directly.

### Backend details
- `InvoiceResponse` now includes:
  - `student_id`
  - `student`
  - `student.school_class`
- The nested student snapshot includes:
  - `id`
  - `first_name`
  - `last_name`
  - `silete_id`
  - `org_id`
  - `class_id`
  - `status`
  - `admission_year`
  - `date_of_birth`
  - `school_class`
- The nested class snapshot includes:
  - `id`
  - `org_id`
  - `name`
  - `level`

### Query behavior
- Invoice list and invoice detail endpoints now eager-load:
  - invoice line items
  - invoice student
  - the student’s school class
- Invoice mutation endpoints that return an invoice now re-fetch the updated invoice with the same nested relationships loaded, so the response stays consistent.

### Frontend details
- The billing list no longer shows placeholder text such as:
  - `Student record`
  - `Class assigned`
  - `Pending class`
- The student column now uses the actual `first_name` and `last_name`.
- The class column now uses `student.school_class.name` and shows the class level when available.
- The invoice details page now also displays the class name beneath the student name.

### Result
- Invoice rows now show real data instead of fallback labels.
- The frontend and backend now agree on the invoice payload structure.
- The class object is available as a full nested object, which gives the UI room to grow later without another API change.
