from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.models.category import Category
from app.repositories.category_repository import CategoryRepository


class CategoryService:
    def __init__(self, db: AsyncSession) -> None:
        self.categories = CategoryRepository(db)

    async def list(self, session_id: UUID) -> list[Category]:
        return await self.categories.list_by_session(session_id)

    async def get(self, session_id: UUID, category_id: UUID) -> Category:
        category = await self.categories.get_by_id(session_id, category_id)
        if category is None:
            raise NotFoundError("Categoria não encontrada")
        return category

    async def create(self, session_id: UUID, name: str) -> Category:
        if await self.categories.get_by_name(session_id, name) is not None:
            raise ConflictError("Já existe uma categoria com este nome")

        return await self.categories.create(
            Category(session_id=session_id, name=name)
        )

    async def update(
        self,
        session_id: UUID,
        category_id: UUID,
        name: str,
    ) -> Category:
        category = await self.get(session_id, category_id)
        category_with_name = await self.categories.get_by_name(session_id, name)
        if category_with_name is not None and category_with_name.id != category.id:
            raise ConflictError("Já existe uma categoria com este nome")

        category.name = name
        return await self.categories.save(category)
