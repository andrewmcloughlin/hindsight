from asgiref.sync import async_to_sync
import asyncio
from hindsight.retros.consumers import RetroConsumer

async def main():
    consumer = RetroConsumer()
    from hindsight.retros.models import Team, User
    team = Team.objects.last()
    user = User.objects.last()
    
    print("Testing team_id:", team.id, "author:", user.username)
    result = await consumer.create_item_db(team.id, "went_well", "testing text", user.username)
    print("Result:", result)

asyncio.run(main())
