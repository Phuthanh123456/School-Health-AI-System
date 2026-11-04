"""Check whether a parent is linked to the requested student."""

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.guards import AuthenticatedUser, require_role
from app.database import get_db


def require_parent_student_link(
    student_id: str,
    current_user: AuthenticatedUser = Depends(require_role("parent")),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    """
    Cho phép Parent tiếp tục nếu được liên kết với học sinh được yêu cầu.

    - current_user.id lấy từ hệ thống xác thực.
    - student_id lấy từ đường dẫn API.
    - Liên kết được kiểm tra trong database.
    """

    link = db.execute(
        text(
            """
            SELECT 1
            FROM schoolhealth_demo.parent_students
            WHERE parent_id = :parent_id
              AND student_id = :student_id
            LIMIT 1
            """
        ),
        {
            "parent_id": current_user.id,
            "student_id": student_id,
        },
    ).first()

    if link is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this student's information",
        )

    return current_user