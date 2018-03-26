const Associations = require('../db/associations')
const Post = Associations.Post
const Image = Associations.Image
const ItemImage = Associations.ItemImage
const Op = require('sequelize').Op
const MarkdownIt = require('markdown-it')
const Utils = require('../utils/utils')
const sequelize = require('../db/index')
const _ = require('lodash')

const getPostList = async function (ctx, next) {
  let currentPage = parseInt(ctx.query.currentPage) > 0 ? parseInt(ctx.query.currentPage) : 1
  let pageSize = parseInt(ctx.query.pageSize) > 0 ? parseInt(ctx.query.pageSize) : 10
  try {
    let result = await Post.findAndCountAll({
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      where: {
        status: {
          [Op.eq]: 1
        }
      }
    })
    ctx.status = 200
    result.currentPage = currentPage
    result.pageSize = pageSize
    ctx.body = {
      code: 0,
      data: result,
      msg: 'success'
    }
  } catch (err) {
    ctx.throw(500, err.message)
  }
}

const getPostById = async function (ctx, next) {
  let id = ctx.params.id
  try {
    let post = await Post.findById(id)
    const markDown = new MarkdownIt({
      html: true // 启用html标记转换
    })
    post.visitCount++
    await post.save()
    ctx.status = 200
    ctx.body = {
      code: 0,
      data: {
        title: post.title,
        content: markDown.render(post.content),
        visitCount: post.visitCount,
        top: post.top,
        publishTime: post.publishTime
      },
      msg: 'success'
    }
  } catch (err) {
    ctx.throw(500, err.message)
  }
}
const getBetweenPostById = async function (ctx, next) {
  let id = ctx.params.id
  let post = null
  let prePostId = null
  let nextPostId = null
  try {
    post = await Post.findById(id)
    prePostId = await Post.max('id', {
      where: {
        id: {
          [Op.lt]: post.id
        }
      }
    })
    nextPostId = await Post.min('id', {
      where: {
        id: {
          [Op.gt]: post.id
        }
      }
    })
    ctx.status = 200
    ctx.body = {
      msg: 'success',
      code: 0,
      data: {
        prePostId,
        nextPostId
      }
    }
  } catch (err) {
    ctx.throw(500, err.message)
  }
}
const getIndexImage = async function (ctx, next) {

}
const addPost = async function (ctx, next) {
  const content = ctx.request.body.content
  const title = ctx.request.body.title
  let extractedImages = Utils.extractImage(content) // 提取 markdown 中的图片地址，供略缩图使用
  const t = await sequelize.transaction() // 开启一个事务
  try {
    let post = await Post.create({
      title,
      content
    },
    {
      transaction: t
    })
    // t.commit()
    let images = await Image.bulkCreate(
      extractedImages,
      { // 将提取出来的图片地址放入数据库
        transaction: t
      })

    if (_.isArray(images)) {
      let imageItems = images.map(image => {
        return {
          imageId: image.id,
          imageAbleId: post.id
        }
      })
      await ItemImage.bulkCreate(
        imageItems,
        {
          transaction: t
        }
      )
      t.commit()
      ctx.status = 200
      ctx.body = {
        code: 0,
        msg: 'success',
        data: []
      }
    } else {
      t.rollback()
      throw new Error('error in Image.bulkCreate')
    }
  } catch (err) {
    t.rollback()
    ctx.throw(500, err.message)
  }
}

module.exports = {
  getPostList,
  getPostById,
  getBetweenPostById,
  getIndexImage,
  addPost
}
