module.exports = (sequelize, type) => {
    return sequelize.define('shoptetCodes', {
        id: {
          type: type.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        code: {
          type: type.STRING(255),
          allowNull: false
        },
        uuid: {
            type: type.STRING(36),
            allowNull: true,
            defaultValue: null
        },
        status: {
            type: type.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        accessToken: {
            type: type.STRING(1024),
            allowNull: true,
            defaultValue: null
        },
        eshopId: {
            type: type.INTEGER(20),
            allowNull: true,
            defaultValue: null
        },
        bearer: {
            type: type.STRING(512),
            allowNull: false,
            defaultValue: ''
        },
        bearerValidity: {
            type: type.DATE,
            allowNull: true,
            defaultValue: null
        }
    }, {
        freezeTableName: true,
        timestamps: false
    });
};