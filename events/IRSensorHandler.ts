import { debug } from '../utils'
import { Client } from 'mqtt'
import { PrismaClient } from '@prisma/client'
import { vn } from '../config/language'
const prisma = new PrismaClient()

const IRSensorHandler = async (client: Client, message: IMessage): Promise<void> => {
  debug.info('ir-sensor', message.action, message.payload)
  /**
   * Cảm biến để thay đổi trang thái đỗ xe
   * FREE->INSERVING->SERVING
   * FREE: sẵn sàng phục vụ
   * INSERVING: Đã được hen trước
   * SERVING: đang phục vụ
   */
  if (message.action == 'change') {
    const { id, serving } = message.payload as IRChangePayload
    debug.verbose('slot-change', id + '', serving)
    // const parking = await prisma.parking.findUnique({
    //   where: {
    //     id,
    //   },
    // })
    const history = await prisma.history.findFirst({
      where: {
        idParking: id,
      },
      include: {
        card: true,
        parking: true,
      },
      orderBy: {
        timeIn: 'desc',
      },
    })
    if (history == null) return
    const { parking, card } = history
    if (parking == null || card == null) return
    // Nếu ở trạng thái free mà trống chỗ thì bỏ quá
    // if (!serving && parking.status == 'FREE') return
    // Nếu ở trạng thái service mà kín chỗ thì bỏ qua
    // if (serving && parking.status == 'SERVING') return

    // Rời khỏi vị trí đỗ -> serving = false
    if (!serving && parking.status == 'SERVING') {
      debug.info('parking', card.id + '', 'leaving')
      // Nếu thẻ không ở trạng thái parking
      if (card.status != 'PARKING') return
      await prisma.history.update({
        where: {
          id: history.id,
        },
        data: {
          parking: {
            update: {
              status: 'FREE',
            },
          },
          card: {
            update: {
              status: 'DRIVING_OUT',
            },
          },
        },
      })
    }
    // Vào bãi đỗ xe -> serving = true
    if (serving && parking.status == 'INSERVING') {
      debug.info('parking', card.id + '', 'driving in')
      // Nếu thẻ không ở trạng thái driving in
      if (card.status != 'DRIVING_IN') return
      await prisma.history.update({
        where: {
          id: history.id,
        },
        data: {
          parking: {
            update: {
              status: 'SERVING',
            },
          },
          card: {
            update: {
              status: 'PARKING',
            },
          },
        },
      })
    }
  }
}
export default IRSensorHandler
